<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_Supabase {
    private $url;
    private $anon_key;
    private $service_role_key;

    public function __construct() {
        $this->url = get_option('atm_supabase_url', '');
        $this->anon_key = get_option('atm_supabase_anon_key', '');
        $this->service_role_key = get_option('atm_supabase_service_role_key', '');
    }

    private function make_request($endpoint, $method = 'GET', $data = null, $use_service_role = false) {
        $url = trailingslashit($this->url) . 'rest/v1/' . $endpoint;

        $headers = array(
            'apikey' => $use_service_role ? $this->service_role_key : $this->anon_key,
            'Authorization' => 'Bearer ' . ($use_service_role ? $this->service_role_key : $this->anon_key),
            'Content-Type' => 'application/json',
        );

        $args = array(
            'method' => $method,
            'headers' => $headers,
            'timeout' => 30,
        );

        if ($data !== null) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return array('error' => $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $status = wp_remote_retrieve_response_code($response);

        if ($status >= 400) {
            return array('error' => 'Request failed with status ' . $status, 'body' => $body);
        }

        return json_decode($body, true);
    }

    public function sync_user($wp_user_id) {
        $user = get_userdata($wp_user_id);
        if (!$user) {
            return false;
        }

        $existing = $this->make_request(
            'users_meta?wordpress_user_id=eq.' . $wp_user_id,
            'GET',
            null,
            true
        );

        if (!empty($existing) && !isset($existing['error'])) {
            $user_data = array(
                'email' => $user->user_email,
                'display_name' => $user->display_name,
                'updated_at' => current_time('c'),
            );

            return $this->make_request(
                'users_meta?wordpress_user_id=eq.' . $wp_user_id,
                'PATCH',
                $user_data,
                true
            );
        } else {
            $user_data = array(
                'wordpress_user_id' => $wp_user_id,
                'email' => $user->user_email,
                'display_name' => $user->display_name,
            );

            return $this->make_request('users_meta', 'POST', $user_data, true);
        }
    }

    public function get_user_by_wp_id($wp_user_id) {
        $response = $this->make_request(
            'users_meta?wordpress_user_id=eq.' . $wp_user_id,
            'GET',
            null,
            true
        );

        if (isset($response['error']) || empty($response)) {
            return null;
        }

        return $response[0];
    }

    public function get($table, $params = array()) {
        $query_string = '';
        if (!empty($params)) {
            $query_string = '?' . http_build_query($params);
        }
        return $this->make_request($table . $query_string, 'GET');
    }

    public function insert($table, $data) {
        return $this->make_request($table, 'POST', $data, true);
    }

    public function update($table, $filter, $data) {
        return $this->make_request($table . '?' . $filter, 'PATCH', $data, true);
    }

    public function delete($table, $filter) {
        return $this->make_request($table . '?' . $filter, 'DELETE', null, true);
    }
}
