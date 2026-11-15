// Generated from mobile/src/timer.ts by web/build.mjs. Do not edit.
                                           

                                                     

                        
                  
                                  
                   
                                                                  
                
 

/** Get ready → round 1 → rest → round 2 → … → final round (no rest after the last one). */
export function buildPhases(s          )          {
  const phases          = [];
  if (s.prepareSec > 0) phases.push({ kind: 'prepare', duration: s.prepareSec * 1000, round: 1 });
  for (let r = 1; r <= s.rounds; r++) {
    phases.push({ kind: 'round', duration: s.roundSec * 1000, round: r });
    if (r < s.rounds && s.restSec > 0) {
      phases.push({ kind: 'rest', duration: s.restSec * 1000, round: r });
    }
  }
  return phases;
}

export function totalDuration(phases         ) {
  return phases.reduce((sum, p) => sum + p.duration, 0);
}

                           
                                                                              
                
                                                
                    
                                                                
                     
 

/** Works out where the workout is after `elapsed` ms of active (unpaused) time. */
export function snapshotAt(phases         , elapsed        )           {
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = acc + phases[i].duration;
    if (elapsed < end) return { index: i, remaining: end - elapsed, phaseStart: acc };
    acc = end;
  }
  return { index: phases.length, remaining: 0, phaseStart: acc };
}

/** Whole seconds shown on the clock: 3:00 at the start of a round, 0:01 in its last second. */
export function displaySeconds(remainingMs        ) {
  return Math.ceil(remainingMs / 1000 - 1e-6);
}
