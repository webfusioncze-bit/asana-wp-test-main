import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    const { data: recurringTasks, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("is_recurring", true)
      .or(`next_occurrence.is.null,next_occurrence.lte.${now}`);

    if (fetchError) {
      throw new Error(`Error fetching recurring tasks: ${fetchError.message}`);
    }

    const processedTasks = [];

    for (const task of recurringTasks || []) {
      if (task.recurrence_end_date && new Date(task.recurrence_end_date) < new Date()) {
        continue;
      }

      const nextOccurrence = calculateNextOccurrence(
        task.next_occurrence || task.due_date || now,
        task.recurrence_rule,
        task.recurrence_interval || 1,
        task.recurrence_days_of_week,
        task.recurrence_day_of_month,
        task.recurrence_month
      );

      const { data: newTask, error: createError } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          folder_id: task.folder_id,
          category_id: task.category_id,
          parent_task_id: task.parent_task_id,
          assigned_to: task.assigned_to,
          created_by: task.created_by,
          priority: task.priority,
          status: "todo",
          due_date: nextOccurrence,
          position: task.position,
          parent_recurring_task_id: task.id,
        })
        .select()
        .single();

      if (createError) {
        console.error(`Error creating task: ${createError.message}`);
        continue;
      }

      const nextNextOccurrence = calculateNextOccurrence(
        nextOccurrence,
        task.recurrence_rule,
        task.recurrence_interval || 1,
        task.recurrence_days_of_week,
        task.recurrence_day_of_month,
        task.recurrence_month
      );

      const { error: updateError } = await supabase
        .from("tasks")
        .update({ next_occurrence: nextNextOccurrence })
        .eq("id", task.id);

      if (updateError) {
        console.error(`Error updating next occurrence: ${updateError.message}`);
      }

      processedTasks.push({
        taskId: task.id,
        newTaskId: newTask?.id,
        nextOccurrence: nextNextOccurrence,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedTasks.length,
        tasks: processedTasks,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

function calculateNextOccurrence(
  currentDate: string,
  rule: string,
  interval: number,
  daysOfWeek?: number[] | null,
  dayOfMonth?: number | null,
  month?: number | null
): string {
  let date = new Date(currentDate);

  switch (rule) {
    case "daily":
      date.setDate(date.getDate() + interval);
      break;

    case "weekly":
      if (daysOfWeek && daysOfWeek.length > 0) {
        const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
        const currentDay = date.getDay();
        let nextDay = sortedDays.find(day => day > currentDay);
        
        if (!nextDay) {
          nextDay = sortedDays[0];
          date.setDate(date.getDate() + ((7 - currentDay + nextDay) % 7 || 7) + 7 * (interval - 1));
        } else {
          date.setDate(date.getDate() + (nextDay - currentDay));
        }
      } else {
        date.setDate(date.getDate() + 7 * interval);
      }
      break;

    case "monthly":
      if (dayOfMonth) {
        date.setMonth(date.getMonth() + interval);
        date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      } else {
        date.setMonth(date.getMonth() + interval);
      }
      break;

    case "yearly":
      if (month && dayOfMonth) {
        date.setFullYear(date.getFullYear() + interval);
        date.setMonth(month - 1);
        date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), month, 0).getDate()));
      } else {
        date.setFullYear(date.getFullYear() + interval);
      }
      break;
  }

  return date.toISOString();
}
