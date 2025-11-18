<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_AJAX {
    private $supabase;

    public function __construct() {
        $this->supabase = new ATM_Supabase();
        $this->init_hooks();
    }

    private function init_hooks() {
        add_action('wp_ajax_atm_sync_user', array($this, 'sync_user'));
        add_action('wp_ajax_atm_get_users', array($this, 'get_users'));
    }

    public function sync_user() {
        check_ajax_referer('atm_nonce', 'nonce');

        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => 'Unauthorized'));
            return;
        }

        $current_user = wp_get_current_user();
        $result = $this->supabase->sync_user($current_user->ID);

        if (isset($result['error'])) {
            wp_send_json_error(array('message' => $result['error']));
            return;
        }

        wp_send_json_success($result);
    }

    public function get_users() {
        check_ajax_referer('atm_nonce', 'nonce');

        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => 'Unauthorized'));
            return;
        }

        $wp_users = get_users(array('fields' => array('ID', 'user_email', 'display_name')));

        $users = array();
        foreach ($wp_users as $wp_user) {
            $supabase_user = $this->supabase->get_user_by_wp_id($wp_user->ID);

            if ($supabase_user) {
                $users[] = array(
                    'id' => $supabase_user['id'],
                    'wordpress_user_id' => $wp_user->ID,
                    'email' => $wp_user->user_email,
                    'display_name' => $wp_user->display_name,
                );
            }
        }

        wp_send_json_success(array('users' => $users));
    }
}

new ATM_AJAX();
