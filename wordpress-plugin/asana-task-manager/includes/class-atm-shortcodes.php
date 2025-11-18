<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_Shortcodes {
    public function __construct() {
        add_shortcode('asana_task_manager', array($this, 'render_task_manager'));
    }

    public function render_task_manager($atts) {
        if (!is_user_logged_in()) {
            return '<p>' . __('Pro zobrazení task manageru se musíte přihlásit.', 'asana-task-manager') . '</p>';
        }

        $atts = shortcode_atts(array(
            'view' => 'list',
        ), $atts);

        wp_enqueue_style('atm-app');
        wp_enqueue_script('atm-app');

        ob_start();
        ?>
        <div id="atm-root" data-view="<?php echo esc_attr($atts['view']); ?>"></div>
        <?php
        return ob_get_clean();
    }
}

new ATM_Shortcodes();
