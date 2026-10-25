// Expo's generated Xcode project says it was last checked with an old Xcode (LastUpgradeCheck = 1130), so every new
// Xcode opens "Update to recommended settings". Those suggestions (user script sandboxing, deployment targets…) are
// not wanted for a generated project (and sandboxing breaks React Native's build scripts), so we mark the project as
// already checked with the current Xcode. Number = Xcode version x 100 (27.1 -> 2710). Raise it when Xcode moves on.
const { withXcodeProject } = require('expo/config-plugins');

const CHECKED_WITH = 2710;

module.exports = (config) =>
  withXcodeProject(config, (c) => {
    const projects = c.modResults.hash.project.objects.PBXProject || {};
    Object.keys(projects).forEach((k) => {
      const p = projects[k];
      if (p && typeof p === 'object' && p.attributes) p.attributes.LastUpgradeCheck = CHECKED_WITH;
    });
    return c;
  });
