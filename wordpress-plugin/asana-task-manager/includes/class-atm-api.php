<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_API {
    private $supabase;

    public function __construct() {
        $this->supabase = new ATM_Supabase();
        $this->init_hooks();
    }

    private function init_hooks() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes() {
        register_rest_route('atm/v1', '/sync-user', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync_user'),
            'permission_callback' => function() {
                return is_user_logged_in();
            },
        ));

        register_rest_route('atm/v1', '/users', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_users'),
            'permission_callback' => function() {
                return is_user_logged_in();
            },
        ));
    }

    public function sync_user($request) {
        $current_user = wp_get_current_user();
        $result = $this->supabase->sync_user($current_user->ID);

        if (isset($result['error'])) {
            return new WP_REST_Response(array('error' => $result['error']), 500);
        }

        return new WP_REST_Response(array('success' => true, 'data' => $result), 200);
    }

    public function get_users($request) {
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

        return new WP_REST_Response(array('users' => $users), 200);
    }
}

new ATM_API();
