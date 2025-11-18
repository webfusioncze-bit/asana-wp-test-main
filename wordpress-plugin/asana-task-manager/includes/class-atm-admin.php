<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_Admin {
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function add_admin_menu() {
        add_menu_page(
            __('Asana Task Manager', 'asana-task-manager'),
            __('Task Manager', 'asana-task-manager'),
            'manage_options',
            'asana-task-manager',
            array($this, 'render_settings_page'),
            'dashicons-list-view',
            30
        );

        add_submenu_page(
            'asana-task-manager',
            __('Nastavení', 'asana-task-manager'),
            __('Nastavení', 'asana-task-manager'),
            'manage_options',
            'asana-task-manager-settings',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('atm_settings', 'atm_supabase_url');
        register_setting('atm_settings', 'atm_supabase_anon_key');
        register_setting('atm_settings', 'atm_supabase_service_role_key');
        register_setting('atm_settings', 'atm_email_notifications_enabled');
        register_setting('atm_settings', 'atm_email_from_name');
        register_setting('atm_settings', 'atm_email_from_address');

        add_settings_section(
            'atm_supabase_section',
            __('Supabase Konfigurace', 'asana-task-manager'),
            array($this, 'supabase_section_callback'),
            'atm_settings'
        );

        add_settings_field(
            'atm_supabase_url',
            __('Supabase URL', 'asana-task-manager'),
            array($this, 'render_text_field'),
            'atm_settings',
            'atm_supabase_section',
            array('field' => 'atm_supabase_url', 'placeholder' => 'https://your-project.supabase.co')
        );

        add_settings_field(
            'atm_supabase_anon_key',
            __('Supabase Anon Key', 'asana-task-manager'),
            array($this, 'render_text_field'),
            'atm_settings',
            'atm_supabase_section',
            array('field' => 'atm_supabase_anon_key', 'placeholder' => 'eyJ...')
        );

        add_settings_field(
            'atm_supabase_service_role_key',
            __('Supabase Service Role Key', 'asana-task-manager'),
            array($this, 'render_text_field'),
            'atm_settings',
            'atm_supabase_section',
            array('field' => 'atm_supabase_service_role_key', 'placeholder' => 'eyJ...')
        );

        add_settings_section(
            'atm_email_section',
            __('Email Notifikace', 'asana-task-manager'),
            array($this, 'email_section_callback'),
            'atm_settings'
        );

        add_settings_field(
            'atm_email_notifications_enabled',
            __('Povolit email notifikace', 'asana-task-manager'),
            array($this, 'render_checkbox_field'),
            'atm_settings',
            'atm_email_section',
            array('field' => 'atm_email_notifications_enabled')
        );

        add_settings_field(
            'atm_email_from_name',
            __('Odesílatel (jméno)', 'asana-task-manager'),
            array($this, 'render_text_field'),
            'atm_settings',
            'atm_email_section',
            array('field' => 'atm_email_from_name', 'placeholder' => 'Task Manager')
        );

        add_settings_field(
            'atm_email_from_address',
            __('Odesílatel (email)', 'asana-task-manager'),
            array($this, 'render_text_field'),
            'atm_settings',
            'atm_email_section',
            array('field' => 'atm_email_from_address', 'placeholder' => 'noreply@example.com')
        );
    }

    public function supabase_section_callback() {
        echo '<p>' . __('Zadejte údaje pro připojení k Supabase databázi.', 'asana-task-manager') . '</p>';
    }

    public function email_section_callback() {
        echo '<p>' . __('Nastavte email notifikace pro úkoly.', 'asana-task-manager') . '</p>';
    }

    public function render_text_field($args) {
        $value = get_option($args['field'], '');
        $type = isset($args['type']) ? $args['type'] : 'text';
        ?>
        <input
            type="<?php echo esc_attr($type); ?>"
            name="<?php echo esc_attr($args['field']); ?>"
            value="<?php echo esc_attr($value); ?>"
            placeholder="<?php echo esc_attr($args['placeholder']); ?>"
            class="regular-text"
        />
        <?php
    }

    public function render_checkbox_field($args) {
        $value = get_option($args['field'], '');
        ?>
        <input
            type="checkbox"
            name="<?php echo esc_attr($args['field']); ?>"
            value="1"
            <?php checked($value, '1'); ?>
        />
        <?php
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        if (isset($_GET['settings-updated'])) {
            add_settings_error('atm_messages', 'atm_message', __('Nastavení uloženo', 'asana-task-manager'), 'updated');
        }

        settings_errors('atm_messages');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <div class="atm-admin-notice">
                <h3><?php _e('Jak začít používat Task Manager', 'asana-task-manager'); ?></h3>
                <ol>
                    <li><?php _e('Vyplňte Supabase konfiguraci níže', 'asana-task-manager'); ?></li>
                    <li><?php _e('Uložte nastavení', 'asana-task-manager'); ?></li>
                    <li><?php _e('Vložte shortcode <code>[asana_task_manager]</code> na stránku nebo do příspěvku', 'asana-task-manager'); ?></li>
                    <li><?php _e('Přihlaste se na webu a začněte spravovat úkoly', 'asana-task-manager'); ?></li>
                </ol>
            </div>

            <form action="options.php" method="post">
                <?php
                settings_fields('atm_settings');
                do_settings_sections('atm_settings');
                submit_button(__('Uložit nastavení', 'asana-task-manager'));
                ?>
            </form>
        </div>
        <?php
    }
}

new ATM_Admin();
