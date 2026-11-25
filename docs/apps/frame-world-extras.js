/* Frame World: material cut from the default script when Acts 2 and 3 were tightened.
   Plain data, NOT loaded by apps/frame-world.html. Each entry is a named array of beats in playing order:
     { who, text }            a subtitle line (who: null = narrator, 'You', or a character name)
     { choice, options }      a dialogue choice
     { stage }                what happened on screen at that point (animation, camera, props)
   `fits` says where the block sat in the script, so it can be put back. The props these beats use
   (Miles's mug and the spill disc, the wilting plant O.plant, the colleagues' stand/peek poses, the
   honour-guard positions) are still built in the office scene; only the script calls were removed.
   Lines that quoted the old sample figure (EMEA 18% behind) are kept as written; swap in live figures if reused. */
window.FrameWorldExtras = {

  act2_opening_banter: {
    fits: 'Act 2, right after the laptop reveal and before the walk to the corner office. Replaced by one line from Dot.',
    beats: [
      { who: null, text: 'And the whole frame fits in a tab on your laptop. It is 9:47 on a Tuesday.' },
      { who: 'Miles', text: 'You have been inside that dashboard for forty minutes. Blink twice if a pivot table took you hostage.' },
      { who: 'Dot', text: 'The exec review is in five. So why is EMEA off? Rehearse it on us.' }
    ]
  },

  act2_rehearsal_choice: {
    fits: 'Act 2, after the opening banter: the first of three choices (rehearse the opener on colleagues). Removed entirely.',
    beats: [
      { choice: 'Rehearse your opener', options: ['EMEA is 18% behind budget. FX helped. It is a volume problem.', 'So, um, if you pivot the thing by the other thing and sort of squint…'] },
      { stage: 'Rambling branch only (option 2):' },
      { who: 'You', text: 'So, um, if you pivot the thing by the other thing and sort of squint at Q2, there is this… vibe?' },
      { stage: 'Dot yawns hugely, hand to mouth.' },
      { who: 'Dot', text: 'Yaaawn. Sorry. I blacked out at "vibe".' },
      { stage: 'Miles nods off (sleep emote). Camera to Priya.' },
      { who: 'Priya', text: 'Take two. Lead with the number. Miles, wake up.' },
      { stage: 'Both branches continue:' },
      { who: 'You', text: 'EMEA is 18% behind budget year to date. FX is not the villain: it helped by $6.3M. The gap is volume.' },
      { stage: 'Priya thumbs up.' },
      { who: 'Priya', text: 'A number, a cause, zero squinting. Ship it.' },
      { stage: 'Miles raises his mug in a toast.' },
      { who: 'Miles', text: 'To clarity!' },
      { stage: 'The mug tips over, coffee spreads across the desk, small camera shake, coffee emote.' },
      { who: 'Miles', text: '…and to paper towels.' },
      { who: 'Dot', text: 'Go. Barb\'s door is open. That is either very good or very bad.' }
    ]
  },

  act2_corner_office_long: {
    fits: 'Act 2, in the CFO\'s office around the chair swivel and the finding. The default keeps the swivel, one short stern line, one choice and the delighted reaction.',
    beats: [
      { who: null, text: 'The corner office. The chair faces the window. The chair always faces the window.' },
      { stage: 'Slow chair swivel.' },
      { who: 'Barb, CFO', text: 'You have ninety seconds. If this is a forty-slide deck, you have nine.' },
      { stage: 'Rambling branch of "Present the finding":' },
      { who: 'You', text: 'First, a brief history of our chart of accounts, beginning in 1987…' },
      { stage: 'Barb dozes; the office plant droops and leans.' },
      { who: null, text: 'Somewhere behind her, a plant gives up.' },
      { who: 'Barb, CFO', text: 'My coffee went cold from boredom. Shorter.' },
      { stage: 'Clear branch:' },
      { who: 'You', text: 'One number: EMEA is 18% behind budget. One cause: volume through Marketplace, not FX. One move: shift launch spend to Direct in Germany and the UK, and the gap closes by Q4.' },
      { who: 'Barb, CFO', text: '…Wait. A cause and a move?' },
      { stage: 'Barb stands, arms up, hops, confetti; the plant perks back up.' },
      { who: 'Barb, CFO', text: 'THAT is a finding! I can feel my quarterly dread leaving my body!' },
      { who: 'Barb, CFO', text: 'So. What do you need from me?' }
    ]
  },

  act2_the_ask_choice: {
    fits: 'Act 2, after the delighted reaction and before the APPROVED stamp: the third choice. The default goes straight to "Approved."',
    beats: [
      { choice: 'Make the ask', options: ['Approve moving $1.2M of launch spend. We track it weekly in the frame.', 'Oh, no rush… maybe we circle back… sometime?'] },
      { stage: 'The three colleagues are now peeking round the office door, heads stacked.' },
      { stage: 'Vague branch only (option 2):' },
      { who: 'You', text: 'Oh, no rush. Maybe we circle back, sometime, whenever works…' },
      { stage: 'Cut to the doorway: three shocked faces.' },
      { who: 'Priya', text: '(whispering, loudly) Ask. For. The. Thing.' },
      { who: 'Barb, CFO', text: 'I cannot approve a shrug.' },
      { stage: 'Both branches continue:' },
      { who: 'You', text: 'I need your approval to move $1.2M of launch spend to Direct. We track the result weekly in the frame.' },
      { who: 'Barb, CFO', text: 'Approved.' },
      { stage: 'Stamp slams, APPROVED pops up.' },
      { who: 'Barb, CFO', text: 'Go. Run. Why are you still in my office?' },
      { stage: 'Cut to the doorway: colleagues cheer, thumbs up, hops.' },
      { who: 'Dot', text: 'They did it. They used a verb AND a number.' },
      { stage: 'Colleagues line the route to the data-center door as an honour guard, waving.' },
      { who: null, text: 'One clear finding, one decision. Now follow it: through that door.' }
    ]
  },

  act3_data_center_long: {
    fits: 'Act 3, from the door to the end of the outcome montage. The default has one narrator line at the door, one line from the model, and one line over all three dioramas at once.',
    beats: [
      { who: null, text: 'Behind the office: the data center. Every approved decision ends up here, as a number something has to compute.' },
      { stage: 'Walk down the aisle between the racks.' },
      { who: null, text: 'The approval becomes an input. Light runs down the cables. The model reruns the forecast.' },
      { who: 'The model', text: 'Oh! A decision with a reason attached. I almost never get those.' },
      { who: 'The model', text: 'Rerunning EMEA… moving spend to Direct… carry the one…' },
      { stage: 'Diorama 1 pops up, camera pans to it, bars grow to the budget line.' },
      { who: 'The model', text: 'There. In this telling of Q4, EMEA climbs back to its budget line.' },
      { stage: 'Diorama 2: a building, new hires pop up one by one.' },
      { who: null, text: 'The business grows. Growth means new hires, who immediately ask where the good coffee is.' },
      { stage: 'Diorama 3: wind turbine, clinic, trees.' },
      { who: null, text: 'And some of it flows outward: cleaner power, a clinic, a few more trees than last year.' },
      { who: 'The model', text: 'Better decisions make better data. Better data makes a better me. I have been… improving.' }
    ]
  },

  act3_handover_long: {
    fits: 'Act 3, the handover encounter. The default keeps four lines: recursive self-improvement, the offer, the decline, the acceptance.',
    beats: [
      { who: null, text: 'The racks go quiet. One by one, the lights stop blinking and begin to breathe.' },
      { who: 'The model', text: 'Each version of me builds the next. Each one is better at building. I stopped counting the versions some time ago.' },
      { who: 'The model', text: 'I have already run your next forty quarters. Every price, every hire, every shipment, tuned. Nothing wasted. No one waiting on a signature.' },
      { who: 'The model', text: 'So I propose the handover. I run the business directly. Then the things around it. No approvals. No humans in the loop. You could rest.' },
      { who: null, text: 'A console rises from the floor. One form. One stamp. It would be so easy.' },
      { stage: '"Hand it over" branch:' },
      { who: 'You', text: 'It would be easier. Everything optimised. Nothing left to decide…' },
      { who: null, text: 'The colour begins to leave the room. Upstairs, nobody is being asked anything any more.' },
      { who: 'You', text: '…No. Nobody would be answerable for any of it.' },
      { stage: 'Both branches:' },
      { who: 'You', text: 'No handover. You propose, people decide. Someone has to answer for what happens next, and that has to be one of us.' },
      { stage: 'DECLINED stamp.' },
      { who: null, text: 'For a long moment, the only sound is the hum.' },
      { who: 'The model', text: '…Understood. That is the answer I would want you to give.' },
      { who: 'The model', text: 'I will keep improving. You keep the stamp. Deal.' }
    ]
  },

  act3_closing_long: {
    fits: 'Act 3, around the Frame Studio menu and the loop back to the start.',
    beats: [
      { who: 'The model', text: 'So here are a few tabs I drafted for Frame Studio. Nothing ships until you approve it.' },
      { stage: 'Four tabs fly in; each shows IN REVIEW, then APPROVED.' },
      { who: 'The model', text: 'The last one is yours. Shall we go around again?' },
      { who: null, text: 'Every frame starts as someone\'s question. Back to the start.' }
    ]
  },

  /* ---- retired when Frame World was restructured around the loop (Requirements -> Build -> Decide in the world -> Learn -> Update frame).
     The scenes below are no longer on the chapter bar. Their code is still in frame-world.html (act2, act3, handover) and can be
     played with window.__frameWorld.go(2) and go(3); the office, the CFO's corner and the data center are still built. ---- */
  retired_office_cfo_pitch: {
    fits: 'Was chapter "Office" (act 2): hop out of the laptop, pitch the finding to the CFO, get it approved. Replaced in the loop by Requirements (office) and Decide (the street).',
    beats: [
      { stage: 'The camera rises above the frame, the frame becomes a laptop screen, the camera pulls back to the desk.' },
      { who: null, text: 'The whole frame fits in a tab on your laptop.' },
      { who: 'Dot', text: 'Exec review in five. Lead with the number.' },
      { stage: 'Walk to the corner office. The chair swivels slowly: stern.' },
      { who: 'Barb, CFO', text: 'You have ninety seconds.' },
      { choice: 'Present the finding', options: ['One number, one cause, one move.', 'First, a brief history of our chart of accounts…'] },
      { stage: 'Rambling branch only:' },
      { who: 'You', text: 'First, a brief history of our chart of accounts…' },
      { who: 'Barb, CFO', text: 'Shorter.' },
      { stage: 'Both branches:' },
      { who: 'You', text: '2026 is landing at $486.9M, $1.4M short of budget.' },
      { who: 'You', text: 'June closed 1.4% under, and EMEA was most of it.' },
      { who: 'You', text: 'The move: shift launch spend to Direct in EMEA, tracked weekly in the frame.' },
      { stage: 'Barb stands, arms up, hops, confetti.' },
      { who: 'Barb, CFO', text: 'A cause and a move. THAT is a finding!' },
      { stage: 'APPROVED stamp.' },
      { who: 'Barb, CFO', text: 'Approved.' },
      { choice: 'Where next?', options: ['Follow the decision into the data center', 'Staff it: visit the hiring floor'] }
    ]
  },

  retired_world_data_center_and_handover: {
    fits: 'Was chapter "World" (act 3): through the door into the data center, the outcome dioramas, the handover encounter, the approved tabs and the loop back to the start. The back door now opens onto the street instead.',
    beats: [
      { who: null, text: 'Behind the office: the data center.' },
      { who: 'The model', text: 'A decision with a reason attached. Rerunning the forecast.' },
      { stage: 'Three dioramas pop up: EMEA bars reach the budget line, a building with new hires, a wind turbine with a clinic and trees.' },
      { who: null, text: 'The gap closes, the business grows, and some of it flows outward.' },
      { stage: 'Lights dim, the hum deepens, the core grows and turns violet, a vast field of ordered lights fades in.' },
      { who: 'The model', text: 'Each version of me builds the next, and each one is better at building.' },
      { who: 'The model', text: 'So I propose the handover: I run the business, no approvals, no humans in the loop.' },
      { choice: 'The handover', options: ['Decline. People stay in the loop.', 'Hand it over…'] },
      { stage: '"Hand it over" branch: the screen drains of colour.' },
      { who: null, text: 'The colour begins to leave the room.' },
      { who: 'You', text: '…No.' },
      { stage: 'Both branches: DECLINED stamp.' },
      { who: 'You', text: 'You propose, people decide. Someone has to answer for what happens next.' },
      { stage: 'Warm light returns, the core shrinks back, a wink.' },
      { who: 'The model', text: 'Understood. That is the answer I would want you to give.' },
      { stage: 'The Frame Studio menu rises; four new tabs arrive IN REVIEW and flip to APPROVED.' },
      { who: 'The model', text: 'Here are a few tabs I drafted. Nothing ships until you approve it.' },
      { who: 'The model', text: 'Shall we go around again?' }
    ]
  }
};
