import * as migration_20261005_174104_initial from './20261005_174104_initial';
import * as migration_20261005_174544_redirects_legacy_id from './20261005_174544_redirects_legacy_id';
import * as migration_20261005_193301_online_store from './20261005_193301_online_store';
import * as migration_20261005_194436_menu_links from './20261005_194436_menu_links';
import * as migration_20261005_194929_whatsapp_contacts from './20261005_194929_whatsapp_contacts';
import * as migration_20261005_202933_page_builder from './20261005_202933_page_builder';
import * as migration_20261005_205418_catalog_tools from './20261005_205418_catalog_tools';
import * as migration_20261005_212316_shipping_payments from './20261005_212316_shipping_payments';
import * as migration_20261005_214730_sales from './20261005_214730_sales';
import * as migration_20261005_220629_site_content from './20261005_220629_site_content';
import * as migration_20261005_222031_post_edit_dates from './20261005_222031_post_edit_dates';
import * as migration_20261006_000458_order_stock from './20261006_000458_order_stock';
import * as migration_20261006_002019_shop_counter from './20261006_002019_shop_counter';
import * as migration_20261006_004016_order_protection from './20261006_004016_order_protection';
import * as migration_20261006_010125_returns_warranty from './20261006_010125_returns_warranty';
import * as migration_20261006_012426_two_factor from './20261006_012426_two_factor';
import * as migration_20261006_013541_cookie_notice from './20261006_013541_cookie_notice';
import * as migration_20261006_015129_sales_channels from './20261006_015129_sales_channels';
import * as migration_20261006_020722_engagement from './20261006_020722_engagement';
import * as migration_20261006_022159_inventory from './20261006_022159_inventory';
import * as migration_20261006_023005_staff_guide from './20261006_023005_staff_guide';
import * as migration_20261006_085112_users_email_verified from './20261006_085112_users_email_verified';
import * as migration_20261006_213603_order_safety from './20261006_213603_order_safety';
import * as migration_20261006_220216_security_hardening from './20261006_220216_security_hardening';
import * as migration_20261006_230758_session_revocation from './20261006_230758_session_revocation';
import * as migration_20261008_144504_guest_customers from './20261008_144504_guest_customers';
import * as migration_20261010_044330_history_and_costs from './20261010_044330_history_and_costs';
import * as migration_20261012_114523_per_page_seo from './20261012_114523_per_page_seo';
import * as migration_20261012_115415_theme_history from './20261012_115415_theme_history';
import * as migration_20261012_120546_product_drafts from './20261012_120546_product_drafts';
import * as migration_20261012_122952_product_variants from './20261012_122952_product_variants';
import * as migration_20261013_233003_multi_tenancy from './20261013_233003_multi_tenancy';
import * as migration_20261014_003019_store_extras from './20261014_003019_store_extras';
import * as migration_20261015_114028_international from './20261015_114028_international';
import * as migration_20261016_000546_pos_currency from './20261016_000546_pos_currency';
import * as migration_20261016_031120_integrations from './20261016_031120_integrations';
import * as migration_20261016_035623_store_api_shipments from './20261016_035623_store_api_shipments';
import * as migration_20261017_110806_security_events from './20261017_110806_security_events';
import * as migration_20261017_121832_support_view from './20261017_121832_support_view';
import * as migration_20261017_123512_shipping_methods from './20261017_123512_shipping_methods';
import * as migration_20261017_124818_gift_cards from './20261017_124818_gift_cards';
import * as migration_20261017_131404_preorders from './20261017_131404_preorders';
import * as migration_20261017_133534_email_optouts from './20261017_133534_email_optouts';
import * as migration_20261017_134900_flash_sale_discount from './20261017_134900_flash_sale_discount';
import * as migration_20261017_142121_tax_classes_billing from './20261017_142121_tax_classes_billing';

export const migrations = [
  {
    up: migration_20261005_174104_initial.up,
    down: migration_20261005_174104_initial.down,
    name: '20261005_174104_initial',
  },
  {
    up: migration_20261005_174544_redirects_legacy_id.up,
    down: migration_20261005_174544_redirects_legacy_id.down,
    name: '20261005_174544_redirects_legacy_id',
  },
  {
    up: migration_20261005_193301_online_store.up,
    down: migration_20261005_193301_online_store.down,
    name: '20261005_193301_online_store',
  },
  {
    up: migration_20261005_194436_menu_links.up,
    down: migration_20261005_194436_menu_links.down,
    name: '20261005_194436_menu_links',
  },
  {
    up: migration_20261005_194929_whatsapp_contacts.up,
    down: migration_20261005_194929_whatsapp_contacts.down,
    name: '20261005_194929_whatsapp_contacts',
  },
  {
    up: migration_20261005_202933_page_builder.up,
    down: migration_20261005_202933_page_builder.down,
    name: '20261005_202933_page_builder',
  },
  {
    up: migration_20261005_205418_catalog_tools.up,
    down: migration_20261005_205418_catalog_tools.down,
    name: '20261005_205418_catalog_tools',
  },
  {
    up: migration_20261005_212316_shipping_payments.up,
    down: migration_20261005_212316_shipping_payments.down,
    name: '20261005_212316_shipping_payments',
  },
  {
    up: migration_20261005_214730_sales.up,
    down: migration_20261005_214730_sales.down,
    name: '20261005_214730_sales',
  },
  {
    up: migration_20261005_220629_site_content.up,
    down: migration_20261005_220629_site_content.down,
    name: '20261005_220629_site_content',
  },
  {
    up: migration_20261005_222031_post_edit_dates.up,
    down: migration_20261005_222031_post_edit_dates.down,
    name: '20261005_222031_post_edit_dates',
  },
  {
    up: migration_20261006_000458_order_stock.up,
    down: migration_20261006_000458_order_stock.down,
    name: '20261006_000458_order_stock',
  },
  {
    up: migration_20261006_002019_shop_counter.up,
    down: migration_20261006_002019_shop_counter.down,
    name: '20261006_002019_shop_counter',
  },
  {
    up: migration_20261006_004016_order_protection.up,
    down: migration_20261006_004016_order_protection.down,
    name: '20261006_004016_order_protection',
  },
  {
    up: migration_20261006_010125_returns_warranty.up,
    down: migration_20261006_010125_returns_warranty.down,
    name: '20261006_010125_returns_warranty',
  },
  {
    up: migration_20261006_012426_two_factor.up,
    down: migration_20261006_012426_two_factor.down,
    name: '20261006_012426_two_factor',
  },
  {
    up: migration_20261006_013541_cookie_notice.up,
    down: migration_20261006_013541_cookie_notice.down,
    name: '20261006_013541_cookie_notice',
  },
  {
    up: migration_20261006_015129_sales_channels.up,
    down: migration_20261006_015129_sales_channels.down,
    name: '20261006_015129_sales_channels',
  },
  {
    up: migration_20261006_020722_engagement.up,
    down: migration_20261006_020722_engagement.down,
    name: '20261006_020722_engagement',
  },
  {
    up: migration_20261006_022159_inventory.up,
    down: migration_20261006_022159_inventory.down,
    name: '20261006_022159_inventory',
  },
  {
    up: migration_20261006_023005_staff_guide.up,
    down: migration_20261006_023005_staff_guide.down,
    name: '20261006_023005_staff_guide',
  },
  {
    up: migration_20261006_085112_users_email_verified.up,
    down: migration_20261006_085112_users_email_verified.down,
    name: '20261006_085112_users_email_verified',
  },
  {
    up: migration_20261006_213603_order_safety.up,
    down: migration_20261006_213603_order_safety.down,
    name: '20261006_213603_order_safety',
  },
  {
    up: migration_20261006_220216_security_hardening.up,
    down: migration_20261006_220216_security_hardening.down,
    name: '20261006_220216_security_hardening',
  },
  {
    up: migration_20261006_230758_session_revocation.up,
    down: migration_20261006_230758_session_revocation.down,
    name: '20261006_230758_session_revocation',
  },
  {
    up: migration_20261008_144504_guest_customers.up,
    down: migration_20261008_144504_guest_customers.down,
    name: '20261008_144504_guest_customers',
  },
  {
    up: migration_20261010_044330_history_and_costs.up,
    down: migration_20261010_044330_history_and_costs.down,
    name: '20261010_044330_history_and_costs',
  },
  {
    up: migration_20261012_114523_per_page_seo.up,
    down: migration_20261012_114523_per_page_seo.down,
    name: '20261012_114523_per_page_seo',
  },
  {
    up: migration_20261012_115415_theme_history.up,
    down: migration_20261012_115415_theme_history.down,
    name: '20261012_115415_theme_history',
  },
  {
    up: migration_20261012_120546_product_drafts.up,
    down: migration_20261012_120546_product_drafts.down,
    name: '20261012_120546_product_drafts',
  },
  {
    up: migration_20261012_122952_product_variants.up,
    down: migration_20261012_122952_product_variants.down,
    name: '20261012_122952_product_variants',
  },
  {
    up: migration_20261013_233003_multi_tenancy.up,
    down: migration_20261013_233003_multi_tenancy.down,
    name: '20261013_233003_multi_tenancy',
  },
  {
    up: migration_20261014_003019_store_extras.up,
    down: migration_20261014_003019_store_extras.down,
    name: '20261014_003019_store_extras',
  },
  {
    up: migration_20261015_114028_international.up,
    down: migration_20261015_114028_international.down,
    name: '20261015_114028_international',
  },
  {
    up: migration_20261016_000546_pos_currency.up,
    down: migration_20261016_000546_pos_currency.down,
    name: '20261016_000546_pos_currency',
  },
  {
    up: migration_20261016_031120_integrations.up,
    down: migration_20261016_031120_integrations.down,
    name: '20261016_031120_integrations',
  },
  {
    up: migration_20261016_035623_store_api_shipments.up,
    down: migration_20261016_035623_store_api_shipments.down,
    name: '20261016_035623_store_api_shipments',
  },
  {
    up: migration_20261017_110806_security_events.up,
    down: migration_20261017_110806_security_events.down,
    name: '20261017_110806_security_events',
  },
  {
    up: migration_20261017_121832_support_view.up,
    down: migration_20261017_121832_support_view.down,
    name: '20261017_121832_support_view',
  },
  {
    up: migration_20261017_123512_shipping_methods.up,
    down: migration_20261017_123512_shipping_methods.down,
    name: '20261017_123512_shipping_methods',
  },
  {
    up: migration_20261017_124818_gift_cards.up,
    down: migration_20261017_124818_gift_cards.down,
    name: '20261017_124818_gift_cards',
  },
  {
    up: migration_20261017_131404_preorders.up,
    down: migration_20261017_131404_preorders.down,
    name: '20261017_131404_preorders',
  },
  {
    up: migration_20261017_133534_email_optouts.up,
    down: migration_20261017_133534_email_optouts.down,
    name: '20261017_133534_email_optouts',
  },
  {
    up: migration_20261017_134900_flash_sale_discount.up,
    down: migration_20261017_134900_flash_sale_discount.down,
    name: '20261017_134900_flash_sale_discount',
  },
  {
    up: migration_20261017_142121_tax_classes_billing.up,
    down: migration_20261017_142121_tax_classes_billing.down,
    name: '20261017_142121_tax_classes_billing'
  },
];
