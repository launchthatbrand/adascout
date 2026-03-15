<?php

require_once ABSPATH . 'wp-includes/pluggable.php';
require_once ABSPATH . 'wp-admin/includes/file.php';

class Adascout_API {

    public function register_routes() {
        register_rest_route( 'adascout', '/validate', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'validate_credentials' ),
            'permission_callback' => array( $this, 'check_application_password' ),
        ) );

        register_rest_route( 'adascout', '/elements', array(
            'methods'  => 'GET',
            'callback' => array( $this, 'get_page_elements' ),
            'permission_callback' => array( $this, 'check_application_password' ),
        ) );

        register_rest_route( 'adascout', '/fix', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'apply_fix' ),
            'permission_callback' => array( $this, 'check_application_password' ),
        ) );
    }

    public function check_application_password() {
        return true;
    }

    public function validate_credentials( WP_REST_Request $request ) {
        $username = $request->get_param( 'username' );
        
        if ( ! $username ) {
            return new WP_Error( 'missing_username', 'Username is required', array( 'status' => 400 ) );
        }

        $user = get_user_by( 'login', $username );
        if ( ! $user ) {
            return new WP_Error( 'invalid_user', 'Invalid username', array( 'status' => 401 ) );
        }

        return array(
            'success' => true,
            'user_id' => $user->ID,
            'username' => $user->user_login,
            'site_url' => get_site_url(),
        );
    }

    public function get_page_elements( WP_REST_Request $request ) {
        $post_id = $request->get_param( 'post_id' );
        
        if ( ! $post_id ) {
            return new WP_Error( 'missing_post_id', 'Post ID is required', array( 'status' => 400 ) );
        }

        $post = get_post( $post_id );
        if ( ! $post ) {
            return new WP_Error( 'invalid_post', 'Post not found', array( 'status' => 404 ) );
        }

        $elements = array();
        
        if ( defined( 'ELEMENTOR_VERSION' ) ) {
            $elementor_data = get_post_meta( $post_id, '_elementor_data', true );
            if ( $elementor_data ) {
                $elements = $this->parse_elementor_elements( json_decode( $elementor_data, true ) );
            }
        }

        return array(
            'post_id' => $post_id,
            'title' => $post->post_title,
            'url' => get_permalink( $post_id ),
            'elements' => $elements,
            'has_elementor' => defined( 'ELEMENTOR_VERSION' ),
        );
    }

    private function parse_elementor_elements( $elements, $parent = null ) {
        $results = array();
        
        if ( ! is_array( $elements ) ) {
            return $results;
        }

        foreach ( $elements as $element ) {
            if ( ! isset( $element['widgetType'] ) ) {
                continue;
            }

            $widget_type = $element['widgetType'];
            $settings = isset( $element['settings'] ) ? $element['settings'] : array();
            $element_id = isset( $element['id'] ) ? $element['id'] : uniqid( 'el_' );

            $element_info = array(
                'id'         => $element_id,
                'widgetType' => $widget_type,
                'settings'   => $settings,
                'parent'     => $parent,
            );

            switch ( $widget_type ) {
                case 'image':
                    $element_info['type'] = 'image';
                    $element_info['currentAlt'] = isset( $settings['image']['alt'] ) ? $settings['image']['alt'] : '';
                    $element_info['currentSrc'] = isset( $settings['image']['url'] ) ? $settings['image']['url'] : '';
                    break;

                case 'button':
                    $element_info['type'] = 'button';
                    $element_info['currentText'] = isset( $settings['text'] ) ? $settings['text'] : '';
                    $element_info['currentAriaLabel'] = isset( $settings['aria_label'] ) ? $settings['aria_label'] : '';
                    break;

                case 'icon-list':
                case 'icon-box':
                    $element_info['type'] = 'link';
                    $element_info['currentAriaLabel'] = isset( $settings['aria_label'] ) ? $settings['aria_label'] : '';
                    break;

                default:
                    $element_info['type'] = 'other';
            }

            $results[] = $element_info;

            if ( isset( $element['elements'] ) && is_array( $element['elements'] ) ) {
                $results = array_merge( $results, $this->parse_elementor_elements( $element['elements'], $element_id ) );
            }
        }

        return $results;
    }

    public function apply_fix( WP_REST_Request $request ) {
        $post_id = $request->get_param( 'post_id' );
        $element_id = $request->get_param( 'element_id' );
        $fix_type = $request->get_param( 'fix_type' );
        $fix_value = $request->get_param( 'fix_value' );

        if ( ! $post_id || ! $element_id || ! $fix_type ) {
            return new WP_Error( 'missing_params', 'Missing required parameters', array( 'status' => 400 ) );
        }

        $post = get_post( $post_id );
        if ( ! $post ) {
            return new WP_Error( 'invalid_post', 'Post not found', array( 'status' => 404 ) );
        }

        if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
            return new WP_Error( 'no_elementor', 'Elementor is not active', array( 'status' => 400 ) );
        }

        $elementor_data = get_post_meta( $post_id, '_elementor_data', true );
        if ( ! $elementor_data ) {
            return new WP_Error( 'no_elementor_data', 'No Elementor data found', array( 'status' => 400 ) );
        }

        $elements = json_decode( $elementor_data, true );
        $modified = $this->apply_fix_to_element( $elements, $element_id, $fix_type, $fix_value );

        if ( ! $modified ) {
            return new WP_Error( 'element_not_found', 'Element not found', array( 'status' => 404 ) );
        }

        update_post_meta( $post_id, '_elementor_data', json_encode( $elements ) );

        if ( class_exists( '\Elementor\Plugin' ) ) {
            $document = \Elementor\Plugin::$instance->documents->get( $post_id );
            if ( $document ) {
                $document->save( array() );
            }
        }

        return array(
            'success' => true,
            'post_id' => $post_id,
            'element_id' => $element_id,
            'fix_type' => $fix_type,
            'fix_value' => $fix_value,
        );
    }

    private function apply_fix_to_element( &$elements, $element_id, $fix_type, $fix_value ) {
        foreach ( $elements as &$element ) {
            if ( isset( $element['id'] ) && $element['id'] === $element_id ) {
                return $this->apply_fix_settings( $element, $fix_type, $fix_value );
            }

            if ( isset( $element['elements'] ) && is_array( $element['elements'] ) ) {
                if ( $this->apply_fix_to_element( $element['elements'], $element_id, $fix_type, $fix_value ) ) {
                    return true;
                }
            }
        }
        return false;
    }

    private function apply_fix_settings( &$element, $fix_type, $fix_value ) {
        if ( ! isset( $element['settings'] ) ) {
            $element['settings'] = array();
        }

        switch ( $fix_type ) {
            case 'alt_text':
                if ( isset( $element['widgetType'] ) && $element['widgetType'] === 'image' ) {
                    $element['settings']['image'] = isset( $element['settings']['image'] ) ? $element['settings']['image'] : array();
                    $element['settings']['image']['alt'] = $fix_value;
                    return true;
                }
                break;

            case 'aria_label':
                $element['settings']['aria_label'] = $fix_value;
                return true;

            case 'text':
                $element['settings']['text'] = $fix_value;
                return true;
        }

        return false;
    }
}
