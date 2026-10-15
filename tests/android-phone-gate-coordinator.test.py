"""Pure coordinator regression; no ADB, network, app writes or gate override."""
from pathlib import Path
import ast,re,unittest
source=Path(__file__).resolve().parents[1]/'scripts/android-assistant/run-gate-two-end.py';module=ast.parse(source.read_text());node=next(x for x in module.body if isinstance(x,ast.ClassDef) and x.name=='TaskPhaseTracker');ns={'re':re};exec(compile(ast.Module(body=[node],type_ignores=[]),str(source),'exec'),ns);Tracker=ns['TaskPhaseTracker']
a='11111111-1111-4111-8111-111111111111';b='22222222-2222-4222-8222-222222222222';c='33333333-3333-4333-8333-333333333333';d='44444444-4444-4444-8444-444444444444';e='55555555-5555-4555-8555-555555555555'
def state(task=a,job=b,terminal='cancelled',active=True,status='selected_count'):return {'taskId':task,'jobId':job,'terminal':terminal,'active':active,'status':status}
class Cases(unittest.TestCase):
 def test_old_cancelled_remains_only_while_preparing_new(self):
  tracker=Tracker('sender',state(active=False),True);self.assertFalse(tracker.observe(state()));self.assertTrue(tracker.observe(state(c,d,'')));self.assertTrue(tracker.observe(state(c,d,'completed',False,'sender_complete')))
 def test_new_cancelled_is_never_ignored(self):
  tracker=Tracker('sender',state(),True)
  with self.assertRaisesRegex(RuntimeError,'TASK_CANCELLED_SENDER'):tracker.observe(state(c,d,'cancelled'))
 def test_real_failure_before_identity_transition(self):
  tracker=Tracker('sender',state(),True)
  for active in (True,False):
   with self.assertRaisesRegex(RuntimeError,'ENGINE_FAILED_SENDER'):tracker.observe(state(active=active,status='gate_failed'))
 def test_idle_baseline_is_not_an_async_success(self):
  tracker=Tracker('sender',state(),True)
  with self.assertRaisesRegex(RuntimeError,'NEW_TASK_NOT_STARTED_SENDER'):tracker.observe(state(active=False))
 def test_half_changed_identity_is_refused(self):
  for task,job in [(a,d),(c,b)]:
   tracker=Tracker('sender',state(),True)
   with self.assertRaisesRegex(RuntimeError,'INCONSISTENT_NEW_TASK_SENDER'):tracker.observe(state(task,job,''))
 def test_frozen_new_identity_cannot_be_replaced(self):
  tracker=Tracker('sender',state(),True);tracker.observe(state(c,d,''))
  with self.assertRaisesRegex(RuntimeError,'TASK_IDENTITY_CHANGED_SENDER'):tracker.observe(state(e,d,''))
 def test_same_task_stages_reject_cancel_or_replacement(self):
  tracker=Tracker('receiver',state(c,d,''),False);self.assertTrue(tracker.observe(state(c,d,'')))
  with self.assertRaisesRegex(RuntimeError,'TASK_CANCELLED_RECEIVER'):tracker.observe(state(c,d,'cancelled'))
  with self.assertRaisesRegex(RuntimeError,'TASK_IDENTITY_CHANGED_RECEIVER'):tracker.observe(state(a,b,''))
 def test_absent_original_and_invalid_uuid_fail_closed(self):
  with self.assertRaisesRegex(RuntimeError,'MISSING_ORIGINAL_TASK'):Tracker('sender',state('','',''),False)
  with self.assertRaisesRegex(RuntimeError,'INVALID_TASK_IDENTITY'):Tracker('sender',state('secret',b),True)
 def test_missing_or_zero_identity_is_not_old_apk_compatibility(self):
  for bad in ({},state('00000000-0000-0000-0000-000000000000',b)):
   with self.assertRaisesRegex(RuntimeError,'INVALID_TASK_IDENTITY'):Tracker('sender',bad,True)
 def test_first_task_can_transition_from_empty_baseline(self):
  tracker=Tracker('sender',state('','','',False),True);self.assertFalse(tracker.observe(state('','','',True)));self.assertTrue(tracker.observe(state(c,d,'')))
if __name__=='__main__':unittest.main()
