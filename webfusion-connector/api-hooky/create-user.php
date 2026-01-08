<?php
function wbf_connector_create_wp_user(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    $username = $request->get_param('username');
    $password = $request->get_param('password');
    $email = $request->get_param('email');
    $role = $request->get_param('role');
    
    if (username_exists($username) || email_exists($email)) {
        return new WP_REST_Response('Username or email already exists', 409);
    }
    
    $user_id = wp_create_user($username, $password, $email);
    if (is_wp_error($user_id)) {
        return new WP_REST_Response($user_id->get_error_message(), 500);
    }
    
    $user = new WP_User($user_id);
    $user->set_role($role);
    
    return new WP_REST_Response('User created successfully', 201);
}

register_rest_route('your-plugin/v1', '/create-user', array(
    'methods' => 'POST',
    'callback' => 'wbf_connector_create_wp_user',
    'args' => array(
        'username' => array(
            'required' => true,
        ),
        'password' => array(
            'required' => true,
        ),
        'email' => array(
            'required' => true,
        ),
        'role' => array(
            'required' => true,
        ),
    ),
));
