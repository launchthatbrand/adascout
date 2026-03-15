<?php
/**
 * Plugin Name: Adascout Connector
 * Plugin URI: https://adascout.com
 * Description: Connect your WordPress site to Adascout for automated accessibility remediation
 * Version: 1.0.0
 * Author: Adascout
 * Author URI: https://adascout.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: adascout-connector
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ADASCOUT_VERSION', '1.0.0' );
define( 'ADASCOUT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ADASCOUT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Main Adascout Connector Class
 */
class Adascout_Connector {

    /**
     * Constructor
     */
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        require_once ADASCOUT_PLUGIN_DIR . 'includes/api.php';
        require_once ADASCOUT_PLUGIN_DIR . 'includes/elementor.php';
        require_once ADASCOUT_PLUGIN_DIR . 'includes/fixes.php';

        $api = new Adascout_API();
        $api->register_routes();
    }
}

/**
 * Initialize the plugin
 */
function adascout_connector_init() {
    new Adascout_Connector();
}
add_action( 'plugins_loaded', 'adascout_connector_init' );
