import { test } from "node:test";
import assert from "node:assert/strict";
import { FollowupTimer } from "../frontend/src/followup-timer.js";

test("auto resume waits the full follow-up window and only fires once", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const timer = new FollowupTimer();
  let resumes = 0;
  timer.arm(
    3000,
    () => true,
    () => resumes++,
  );
  t.mock.timers.tick(2999);
  assert.equal(resumes, 0);
  t.mock.timers.tick(1);
  assert.equal(resumes, 1);
  t.mock.timers.tick(3000);
  assert.equal(resumes, 1);
});
test("user activity cancels countdown; new output starts a fresh window", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const timer = new FollowupTimer();
  let resumes = 0;
  timer.arm(
    3000,
    () => true,
    () => resumes++,
  );
  t.mock.timers.tick(2000);
  timer.cancel();
  t.mock.timers.tick(5000);
  assert.equal(resumes, 0);
  timer.arm(
    3000,
    () => true,
    () => resumes++,
  );
  t.mock.timers.tick(2000);
  timer.arm(
    3000,
    () => true,
    () => resumes++,
  );
  t.mock.timers.tick(2000);
  assert.equal(resumes, 0);
  t.mock.timers.tick(1000);
  assert.equal(resumes, 1);
});
test("stale state, pending work, disabled option cannot resume", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const timer = new FollowupTimer();
  let eligible = true;
  let resumes = 0;
  timer.arm(
    3000,
    () => eligible,
    () => resumes++,
  );
  eligible = false;
  t.mock.timers.tick(3000);
  assert.equal(resumes, 0);
  timer.arm(
    3000,
    () => false,
    () => resumes++,
  );
  timer.arm(
    0,
    () => true,
    () => resumes++,
  );
  t.mock.timers.tick(10000);
  assert.equal(resumes, 0);
});
