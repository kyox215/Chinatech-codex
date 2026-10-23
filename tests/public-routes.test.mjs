import assert from "node:assert/strict";
import test from "node:test";
import { legacyPublicDestination, isPublicActivityPath } from "../lib/public-routes.ts";

test("old homepage bookmarks reach the new child pages and retain query parameters", () => {
  for (const section of ["features", "tutorials", "workflow", "questions"]) {
    assert.equal(legacyPublicDestination(`#${section}`, "?source=bookmark"), `/repair?source=bookmark#${section}`);
  }
  assert.equal(legacyPublicDestination("#cinema"), "/cinema");
  assert.equal(legacyPublicDestination("#%74utorials"), "/repair#tutorials");
});

test("skip links, unknown fragments and malformed input remain on the portal", () => {
  for (const hash of ["", "#", "#main-content", "#unknown", "#%", "#//external.test", "#tutorials/extra"]) {
    assert.equal(legacyPublicDestination(hash), null);
  }
});

test("public activity classification includes moved pages without classifying private or similar paths", () => {
  for (const path of ["/", "/repair", "/cinema", "/toolbox", "/toolbox/office", "/toolbox/transfer/mobiletrans"]) assert.equal(isPublicActivityPath(path), true, path);
  for (const path of ["/repairs", "/repair/private", "/cinema-extra", "/toolboxes", "/app/dashboard", "/account/stores", "/login"]) assert.equal(isPublicActivityPath(path), false, path);
});
