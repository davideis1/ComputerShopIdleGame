// Google Play Games Services needs the Game Services project id in the manifest (meta-data
// com.google.android.gms.games.APP_ID -> @string/game_services_project_id, declared by modules/play-games). The module ships a
// placeholder; this plugin writes the real number from app.json: ["./plugins/withPlayGames", { "projectId": "1234567890" }].
// Find it in the Play Console: Play Games Services -> Configuration ("Project ID", digits only).
const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

module.exports = (config, props = {}) => {
  const projectId = String(props.projectId || '').trim();
  if (!projectId) return config; // not set up yet: the module's placeholder stays
  return withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'game_services_project_id', translatable: 'false' }, _: projectId }],
      c.modResults,
    );
    return c;
  });
};
