<?php
/**
 * Plugin Name: Adascout Elementor Accessibility
 * Plugin URI: https://adascout.com
 * Description: Connect your Elementor-powered site to Adascout for automated accessibility remediation
 * Version: 1.0.0
 * Author: Adascout
 * Author URI: https://adascout.com
 * License: GPL v2 or later
 * Text Domain: adascout-elementor
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ADASCOUT_ELEMENTOR_VERSION', '1.0.0');
define('ADASCOUT_ELEMENTOR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ADASCOUT_ELEMENTOR_REST_NAMESPACE', 'adascout/v1');

class Adascout_Elementor_Plugin {
    
    private $option_name = 'adascout_elementor_settings';
    private $client_id;
    private $client_secret;
    
    public function __construct() {
        $this->client_id = get_option('adascout_client_id', '');
        $this->client_secret = get_option('adascout_client_secret', '');
        
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }
    
    public function register_rest_routes() {
        // OAuth endpoints
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/connect', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_connect'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);
        
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/disconnect', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_disconnect'],
            'permission_callback' => [$this, 'check_admin_permission'],
        ]);
        
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/status', [
            'methods' => 'GET',
            'callback' => [$this, 'get_connection_status'],
            'permission_callback' => '__return_true',
        ]);
        
        // Elementor remediation endpoints
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/pages', [
            'methods' => 'GET',
            'callback' => [$this, 'get_elementor_pages'],
            'permission_callback' => [$this, 'check_connection_permission'],
        ]);
        
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/page/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_page_elementor_data'],
            'permission_callback' => [$this, 'check_connection_permission'],
        ]);
        
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/fix', [
            'methods' => 'POST',
            'callback' => [$this, 'fix_elementor_element'],
            'permission_callback' => [$this, 'check_connection_permission'],
        ]);
        
        register_rest_route(ADASCOUT_ELEMENTOR_REST_NAMESPACE, '/fix-page', [
            'methods' => 'POST',
            'callback' => [$this, 'fix_page_all_issues'],
            'permission_callback' => [$this, 'check_connection_permission'],
        ]);
    }
    
    public function check_admin_permission() {
        return current_user_can('manage_options');
    }
    
    public function check_connection_permission() {
        $settings = get_option($this->option_name, []);
        return !empty($settings['connected']) && !empty($settings['site_id']);
    }
    
    public function handle_connect(WP_REST_Request $request) {
        $site_id = $request->get_param('site_id');
        $site_url = $request->get_param('site_url');
        
        if (empty($site_id) || empty($site_url)) {
            return new WP_Error('missing_params', 'Missing required parameters', ['status' => 400]);
        }
        
        $settings = [
            'connected' => true,
            'site_id' => $site_id,
            'site_url' => $site_url,
            'connected_at' => time(),
        ];
        
        update_option($this->option_name, $settings);
        
        return rest_ensure_response([
            'success' => true,
            'message' => 'Connected to Adascout',
        ]);
    }
    
    public function handle_disconnect(WP_REST_Request $request) {
        delete_option($this->option_name);
        
        return rest_ensure_response([
            'success' => true,
            'message' => 'Disconnected from Adascout',
        ]);
    }
    
    public function get_connection_status(WP_REST_Request $request) {
        $settings = get_option($this->option_name, []);
        
        return rest_ensure_response([
            'connected' => !empty($settings['connected']),
            'site_id' => $settings['site_id'] ?? null,
            'site_url' => $settings['site_url'] ?? null,
            'connected_at' => $settings['connected_at'] ?? null,
        ]);
    }
    
    public function get_elementor_pages(WP_REST_Request $request) {
        $args = [
            'post_type' => ['page', 'post'],
            'posts_per_page' => -1,
            'post_status' => 'any',
            'meta_key' => '_elementor_data',
            'meta_compare' => 'EXISTS',
        ];
        
        $query = new WP_Query($args);
        $pages = [];
        
        foreach ($query->posts as $post) {
            $pages[] = [
                'id' => $post->ID,
                'title' => $post->post_title,
                'status' => $post->post_status,
                'url' => get_permalink($post->ID),
                'edit_url' => get_edit_post_link($post->ID),
            ];
        }
        
        return rest_ensure_response($pages);
    }
    
    public function get_page_elementor_data(WP_REST_Request $request) {
        $post_id = $request->get_param('id');
        
        $post = get_post($post_id);
        if (!$post) {
            return new WP_Error('not_found', 'Post not found', ['status' => 404]);
        }
        
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        
        if (empty($elementor_data)) {
            return new WP_Error('no_elementor_data', 'No Elementor data found', ['status' => 404]);
        }
        
        $decoded = json_decode($elementor_data, true);
        
        // Extract images and their current alt texts
        $images = $this->extract_images($decoded);
        
        return rest_ensure_response([
            'id' => $post->ID,
            'title' => $post->post_title,
            'elementor_data' => $decoded,
            'images' => $images,
        ]);
    }
    
    private function extract_images($data, $parent_id = '') {
        $images = [];
        
        if (!is_array($data)) {
            return $images;
        }
        
        foreach ($data as $key => $value) {
            if ($key === 'id' && is_string($value)) {
                $parent_id = $value;
            }
            
            // Check if this is an image widget
            if (isset($value['widgetType']) && $value['widgetType'] === 'image') {
                $settings = $value['settings'] ?? [];
                $image_data = $settings['image'] ?? [];
                
                $images[] = [
                    'element_id' => $value['id'] ?? $parent_id,
                    'widget_type' => 'image',
                    'url' => $image_data['url'] ?? '',
                    'alt' => $image_data['alt'] ?? '',
                    'title' => $image_data['title'] ?? '',
                    'caption' => $image_data['caption'] ?? '',
                ];
            }
            
            // Check for nested elements
            if (isset($value['elements']) && is_array($value['elements'])) {
                $images = array_merge($images, $this->extract_images($value['elements'], $parent_id));
            }
            
            // Check for inner containers
            if (isset($value['isInner']) && $value['isInner'] && isset($value['elements'])) {
                $images = array_merge($images, $this->extract_images($value['elements'], $parent_id));
            }
        }
        
        return $images;
    }
    
    public function fix_elementor_element(WP_REST_Request $request) {
        $post_id = $request->get_param('post_id');
        $element_id = $request->get_param('element_id');
        $fix_type = $request->get_param('fix_type');
        $fix_value = $request->get_param('fix_value');
        
        if (empty($post_id) || empty($element_id) || empty($fix_type)) {
            return new WP_Error('missing_params', 'Missing required parameters', ['status' => 400]);
        }
        
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        
        if (empty($elementor_data)) {
            return new WP_Error('no_elementor_data', 'No Elementor data found', ['status' => 404]);
        }
        
        $decoded = json_decode($elementor_data, true);
        
        $modified = $this->modify_element($decoded, $element_id, $fix_type, $fix_value);
        
        if ($modified === false) {
            return new WP_Error('element_not_found', 'Element not found', ['status' => 404]);
        }
        
        // Save the modified data
        $encoded = json_encode($modified);
        update_post_meta($post_id, '_elementor_data', $encoded);
        
        // Clear Elementor CSS cache
        delete_post_meta($post_id, '_elementor_css');
        
        // Trigger Elementor document cache refresh
        do_action('elementor/core/document/save/data', $post_id);
        
        return rest_ensure_response([
            'success' => true,
            'message' => "Fixed {$fix_type} for element {$element_id}",
            'fix_type' => $fix_type,
            'fix_value' => $fix_value,
        ]);
    }
    
    private function modify_element($data, $element_id, $fix_type, $fix_value) {
        if (!is_array($data)) {
            return false;
        }
        
        foreach ($data as $key => &$item) {
            // Check if this is the target element
            if (isset($item['id']) && $item['id'] === $element_id) {
                if (!$this->apply_fix($item, $fix_type, $fix_value)) {
                    continue;
                }
                return $data;
            }
            
            // Check nested elements
            if (isset($item['elements']) && is_array($item['elements'])) {
                $result = $this->modify_element($item['elements'], $element_id, $fix_type, $fix_value);
                if ($result !== false) {
                    $item['elements'] = $result;
                    return $data;
                }
            }
            
            // Check inner containers
            if (isset($item['isInner']) && isset($item['elements'])) {
                $result = $this->modify_element($item['elements'], $element_id, $fix_type, $fix_value);
                if ($result !== false) {
                    $item['elements'] = $result;
                    return $data;
                }
            }
        }
        
        return false;
    }
    
    private function apply_fix(&$element, $fix_type, $fix_value) {
        $settings = &$element['settings'];
        
        switch ($fix_type) {
            case 'alt_text':
                if (isset($settings['image']) && is_array($settings['image'])) {
                    $settings['image']['alt'] = $fix_value;
                    return true;
                }
                break;
                
            case 'link_text':
                if (isset($settings['text'])) {
                    $settings['text'] = $fix_value;
                    return true;
                }
                break;
                
            case 'heading_text':
                if (isset($settings['title'])) {
                    $settings['title'] = $fix_value;
                    return true;
                }
                break;
                
            case 'heading_size':
                if (isset($settings['title_size'])) {
                    $settings['title_size'] = $fix_value;
                    return true;
                }
                break;
                
            case 'button_text':
                if (isset($settings['text'])) {
                    $settings['text'] = $fix_value;
                    return true;
                }
                break;
                
            case 'form_label':
                if (isset($settings['form_fields'])) {
                    // Find the field and update label
                    foreach ($settings['form_fields'] as &$field) {
                        if (isset($field['custom_id']) && $field['custom_id'] === $fix_value['field_id']) {
                            $field['field_label'] = $fix_value['label'];
                            return true;
                        }
                    }
                }
                break;
        }
        
        return false;
    }
    
    public function fix_page_all_issues(WP_REST_Request $request) {
        $post_id = $request->get_param('post_id');
        $issues = $request->get_param('issues');
        
        if (empty($post_id) || empty($issues)) {
            return new WP_Error('missing_params', 'Missing required parameters', ['status' => 400]);
        }
        
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);
        
        if (empty($elementor_data)) {
            return new WP_Error('no_elementor_data', 'No Elementor data found', ['status' => 404]);
        }
        
        $decoded = json_decode($elementor_data, true);
        $fixed_count = 0;
        
        foreach ($issues as $issue) {
            $element_id = $issue['element_id'] ?? '';
            $fix_type = $issue['fix_type'] ?? '';
            $fix_value = $issue['fix_value'] ?? '';
            
            if (empty($element_id) || empty($fix_type)) {
                continue;
            }
            
            $result = $this->modify_element($decoded, $element_id, $fix_type, $fix_value);
            if ($result !== false) {
                $fixed_count++;
            }
        }
        
        if ($fixed_count > 0) {
            $encoded = json_encode($decoded);
            update_post_meta($post_id, '_elementor_data', $encoded);
            delete_post_meta($post_id, '_elementor_css');
            do_action('elementor/core/document/save/data', $post_id);
        }
        
        return rest_ensure_response([
            'success' => true,
            'fixed_count' => $fixed_count,
            'total_issues' => count($issues),
        ]);
    }
    
    // Admin UI
    public function add_admin_menu() {
        add_options_page(
            'Adascout Elementor',
            'Adascout Elementor',
            'manage_options',
            'adascout-elementor',
            [$this, 'admin_page']
        );
    }
    
    public function register_settings() {
        register_setting('adascout_elementor', 'adascout_client_id');
        register_setting('adascout_elementor', 'adascout_client_secret');
    }
    
    public function admin_page() {
        $settings = get_option($this->option_name, []);
        ?>
        <div class="wrap">
            <h1>Adascout Elementor Integration</h1>
            
            <?php if (empty($settings['connected'])): ?>
            <div class="card" style="max-width: 600px; margin-top: 20px;">
                <h2>Connect Your Site</h2>
                <p>Enter your Adascout credentials to connect this site for automated accessibility remediation.</p>
                
                <form method="post" action="<?php echo rest_url(ADASCOUT_ELEMENTOR_REST_NAMESPACE . '/connect'); ?>">
                    <?php wp_nonce_field('wp_rest', '_wpnonce'); ?>
                    <input type="hidden" name="site_id" value="<?php echo get_bloginfo('url'); ?>">
                    <input type="hidden" name="site_url" value="<?php echo get_bloginfo('url'); ?>">
                    
                    <p>
                        <label>Site ID:</label><br>
                        <input type="text" name="site_id" value="" style="width: 100%;">
                    </p>
                    
                    <p>
                        <input type="submit" class="button button-primary" value="Connect to Adascout">
                    </p>
                </form>
            </div>
            <?php else: ?>
            <div class="card" style="max-width: 600px; margin-top: 20px;">
                <h2>Connected</h2>
                <p><strong>Site ID:</strong> <?php echo esc_html($settings['site_id']); ?></p>
                <p><strong>Connected:</strong> <?php echo date('Y-m-d H:i', $settings['connected_at']); ?></p>
                
                <form method="post" action="<?php echo rest_url(ADASCOUT_ELEMENTOR_REST_NAMESPACE . '/disconnect'); ?>">
                    <?php wp_nonce_field('wp_rest', '_wpnonce'); ?>
                    <p><input type="submit" class="button button-secondary" value="Disconnect"></p>
                </form>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }
}

new Adascout_Elementor_Plugin();
