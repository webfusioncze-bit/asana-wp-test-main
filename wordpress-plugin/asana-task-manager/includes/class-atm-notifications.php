<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_Notifications {
    private $supabase;

    public function __construct() {
        $this->supabase = new ATM_Supabase();
        $this->init_hooks();
    }

    private function init_hooks() {
        add_action('atm_send_notification', array($this, 'send_notification'), 10, 4);
        add_action('atm_check_overdue_tasks', array($this, 'check_overdue_tasks'));

        if (!wp_next_scheduled('atm_check_overdue_tasks')) {
            wp_schedule_event(time(), 'hourly', 'atm_check_overdue_tasks');
        }
    }

    public function send_notification($user_id, $task_id, $type, $data) {
        $notification_data = array(
            'user_id' => $user_id,
            'task_id' => $task_id,
            'type' => $type,
            'title' => $data['title'],
            'message' => $data['message'],
            'is_read' => false,
            'is_email_sent' => false,
        );

        $result = $this->supabase->insert('notifications', $notification_data);

        if (!isset($result['error']) && get_option('atm_email_notifications_enabled') === '1') {
            $this->send_email_notification($user_id, $data);

            if (!empty($result) && isset($result[0]['id'])) {
                $this->supabase->update(
                    'notifications',
                    'id=eq.' . $result[0]['id'],
                    array('is_email_sent' => true)
                );
            }
        }
    }

    private function send_email_notification($user_id, $data) {
        $supabase_user = $this->supabase->get_user_by_wp_id($user_id);
        if (!$supabase_user) {
            return;
        }

        $to = $supabase_user['email'];
        $subject = $data['title'];
        $message = $data['message'];

        $from_name = get_option('atm_email_from_name', 'Task Manager');
        $from_email = get_option('atm_email_from_address', 'noreply@' . $_SERVER['HTTP_HOST']);

        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $from_name . ' <' . $from_email . '>',
        );

        $email_body = $this->get_email_template($data['title'], $data['message']);

        wp_mail($to, $subject, $email_body, $headers);
    }

    private function get_email_template($title, $message) {
        ob_start();
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
                .footer { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6b7280; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin: 0;"><?php echo esc_html($title); ?></h2>
                </div>
                <div class="content">
                    <?php echo wpautop(esc_html($message)); ?>
                    <a href="<?php echo home_url(); ?>" class="button">Zobrazit úkoly</a>
                </div>
                <div class="footer">
                    <p>Tento email byl automaticky vygenerován systémem Task Manager.</p>
                </div>
            </div>
        </body>
        </html>
        <?php
        return ob_get_clean();
    }

    public function check_overdue_tasks() {
        $tasks = $this->supabase->get('tasks', array(
            'status' => 'neq.completed',
            'due_date' => 'lt.' . current_time('c'),
        ));

        if (isset($tasks['error']) || empty($tasks)) {
            return;
        }

        foreach ($tasks as $task) {
            $this->send_notification(
                $task['assigned_to'],
                $task['id'],
                'overdue',
                array(
                    'title' => 'Úkol po termínu',
                    'message' => 'Úkol "' . $task['title'] . '" je po termínu dokončení.',
                )
            );
        }
    }
}

new ATM_Notifications();
