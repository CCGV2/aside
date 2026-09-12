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

test("visible deadline is cleared on cancellation and rejected expiry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  const deadlines: (number | null)[] = [];
  const timer = new FollowupTimer((deadline) => deadlines.push(deadline));
  let eligible = true;
  timer.arm(
    3000,
    () => eligible,
    () => assert.fail("must not resume"),
  );
  assert.equal(deadlines.at(-1), 4000);
  eligible = false;
  t.mock.timers.tick(3000);
  assert.equal(deadlines.at(-1), null);
  timer.arm(
    8000,
    () => true,
    () => assert.fail("cancelled"),
  );
  timer.cancel();
  assert.equal(deadlines.at(-1), null);
  t.mock.timers.tick(8000);
});
