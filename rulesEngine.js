let nextRuleId = 1000; // dynamic starting ID

// Essential cookies never blocked
export const ESSENTIAL_COOKIES = ["PHPSESSID", "JSESSIONID", "sessionid", "csrf_token", "auth_token"];

// List of known tracker domains to block 
// Could be expanded or updated as needed
export const TRACKER_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
  'fbcdn.net', 'scorecardresearch.com', 'quantserve.com', 'dotmetrics.net',
  'adservice.google.com', 'adroll.com', 'media.net', 'tapjoy.com', 
  'criteo.com', 'addthis.com', 'piwik.pro', 'chartbeat.com', 'segment.com', 
  'mixpanel.com', 'revcontent.com', 'taboola.com', 'quantcast.com', 'openx.net',
  'zergnet.com', 'bidswitch.net', 'bluekai.com', 'lotame.com', 'crwdcntrl.net',
  'getclicky.com', 'outbrain.com', 'advertising.com', 'braintreepayments.com', 
  'moat.com', 'yandex.ru', 'flurry.com', 'seamlessdocs.com', 'pusher.com',
  'bluekai.com', 't.co', 'vidlux.com', 'vidmark.com', 'vidyard.com', 'viglink.com',
  'vilynx.com', 'vindicosuite.com', 'visistat.com', 'visit.geocities.com', 
  'visitors.dooyoo.de', 'visitortracklog.com', 'vistaoffers.info', 'visualdna.com', 
  'visualrevenue.com', 'visualvote.com', 'visualwebsiteoptimizer.com', 'vizu.com', 
  'vncovers.com', 'voicefive.com', 'voluumtrk.com', 'voluumtrk2.com', 'voluumtrk3.com', 
  'vortex-bn2.metron.live.com.nsatc.net', 'vortex-cy2.metron.live.com.nsatc.net', 
  'vortex-win.data.microsoft.com', 'voucher-club.com', 'voucheralley.com', 'vouchercodeclub.com', 
  'voucherwindow.com', 'voxmedia.com', 'voycme.com', 'vppgamingnetwork.com', 'vrtztrk.com', 
  'vserv.mobi', 'vservdigital.com', 'vservmobi.com', 'vungle.com', 'vvbox.cz', 'vwdservices.com', 
  'w55c.net', 'walkme.com', 'waparena.xyz', 'watcheezy.net', 'waterthurst.com', 'watson.live.com', 
  'watson.microsoft.com', 'waudit.cz', 'wayjump.com', 'wci-fl.com', 'we-stats.com', 'web-01-gbl.com', 
  'web-cam-model.com', 'web-cntr-09.com', 'web-cntr-10.com', 'web-cntr-11.com', 'web-track.telekom-dienste.de',
  'web-visor.com', 'webanalyse.ronet.info', 'webanalytics.btelligent.net', 'webanalytics2.ovh.net', 
  'webanalyticsday.com', 'webapplicationstreamingnetwork.com', 'webapplicationstreamingnetwork.info', 
  'webapplicationstreamingnetwork.net', 'webappstreamingnetwork.com', 'webappstreamingnetwork.info',
  'webappstreamingnetwork.net', 'webappstreamingnetwork.org', 'webcollage.com', 'webcollage.net', 
  'webcounterfox.com', 'webengage.co', 'webgains.com', 'webhits.de', 'webleads-tracker.com', 
  'webmasterprofitcenter.com', 'webmd.com', 'webrankresearch.com', 'webrankresearch.net', 'websas.hu', 
  'webserviceaward.com', 'website-performance-beacon.autotrader.co.uk', 'websitepagetracker.com', 
  'websiteperform.com', 'websitetrafficspy.com', 'websitezugriffe.de', 'webspectator.biz', 'webspectator.com',
  'webspectator.info', 'webspectator.mobi', 'webspectator.us', 'webstat.channel4.com', 'webstat.net',
  'webstatistik.bg-kooperation.de', 'webstats.com.br', 'webstats.lx.ro', 'webstatsresearch.com', 
  'webstatsresearch.net', 'webtraffic.se', 'webtrekk-asia.net', 'webtrekk.com', 'webtrekk.de', 
  'webtrekk.mediaset.net', 'webtrekk.mobi', 'webtrekk.net', 'webtrekk.org', 'webtrends.com',
  'webtrends.telegraph.co.uk', 'webtrendslive.com', 'webtrendssdc.roadrunnerrecords.com', 'webvitality.me', 
  'wedgies.com', 'wemedredmobmsmt.com', 'wemfbox.ch', 'wernmen.net', 'whoisvisiting.com', 'whyanalytics.com', 
  'wickhillnews.com', 'wikia-beacon.com', 'win30000.com', 'win30000.net', 'pipedream.wistia.com', 
  'distillery.wistia.com', 'wistia.net', 'wobbegongmedia.net', 'woopic.com', 'woopra-ns.com', 'woopra.com',
  'workdesk.click', 'worldwideoffers.net', 'wowanalytics.co.uk', 'wowcon.net', 'wp.gl', 'wpa.qq.com', 
  'wpdigital.net', 'wrightsmedia.com', 'ws-outage.com', 'wshifen.com', 'wt-eu02.net', 'wt-safetag.com',
  'wtp101.com', 'wtsense.com', 'wttrc.com', 'wunderloop.net', 'wup.browser.qq.com', 'wup.imtt.qq.com', 
  'wwa.wipe.de', 'wwpxl.com', 'www.audio2.spotify.com', 'www.gold.smbusinessbiz.com', 'www.group-metrics.com', 
  'www.hypertracker.com', 'www.rsmtrack.com', 'www1.mpnrs.com', 'www2.a-counter.kiev.ua', 'www2.mpnrs.com',
  'wwwpromoter.com', 'wysistat.net', 'wywy.com', 'xcgyouitngcbnkusthmtcspesn.com', 'xch.themediaexchange.eu',
  'xclicks.net', 'xct31.net', 'xct32.net', 'xct33.net', 'xg4ken.com', 'xhbaihehang.com', 'xibei70.com', 
  'xiti.com', 'xixiwan.net', 'xoclkrvstrafms.com', 'xploreroffers.com', 'xs.gy', 'xzhmjoch.bid', 'y-track.com', 
  'y5wflt0xibmoufuvsayg1efy80yq0ystkjncf76cqm.com', 'yabs.yandex.ru', 'yadro.ru', 'yadsrflowms.com',
  'yarpp.org', 'ybsitecenter.com', 'ybx.io', 'yellgroup.com', 'yellowdragonsoft.com', 'yenton.org', 
  'yesware.com', 'yieldify.com', 'yieldlab.net', 'yieldmanager.com', 'yieldmanager.net'
];


// Create a blocking rule for a given domain, to block various types of requests from that domain
export function createBlockRule(domain) {
  return {
    id: nextRuleId++, // Assign a unique ID for the rule
    priority: 1, // Set the priority of the rule (lower number means higher priority)
    action: { type: "block" }, // Action to take: block the request
    condition: {
      // URL filter to block requests from the domain (works for any protocol)
      urlFilter: `*://*.${domain}/*`,
      resourceTypes: [
        "main_frame", "sub_frame", "xmlhttprequest",
        "script", "image", "websocket"
      ] // Block various resource types such as scripts, images, and XHR
    }
  };
}

// Function to update the blocking rules dynamically in declarativeNetRequest API
export async function updateRules() {
  // Create blocking rules for each tracker domain
  const rules = TRACKER_DOMAINS.map(d => createBlockRule(d));
  
  // Get the existing dynamic rules (if any) in the system
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  
  // Get the IDs of the existing rules to remove them before adding new ones
  const removeIds = existing.map(r => r.id);
  
  // Update the dynamic rules with the new blocking rules, removing old ones
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds, // Remove old rules
    addRules: rules // Add the new blocking rules
  });
}