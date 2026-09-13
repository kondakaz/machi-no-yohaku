/* Minute-by-minute snapshots preserve schedule edits when scrubbing backward.
 * An edit made in the past starts a new future from that minute. */
(function(root,factory){
  if(typeof module!=='undefined'&&module.exports)module.exports=factory(require('./engine.js'));
  else root.BusTimeline=factory(root.BusSim);
})(typeof window!=='undefined'?window:globalThis,function(S){
  'use strict';
  function create(seed,mode){
    let state=S.create(seed,mode);
    const history=[structuredClone(state)];
    function seek(minute){
      const target=Math.max(0,Math.min(180,Math.round(Number(minute)||0)));
      if(target>=history.length){
        state=structuredClone(history[history.length-1]);
        while(state.time<target){S.step(state);history.push(structuredClone(state));}
      }
      state=structuredClone(history[target]);
      return state;
    }
    function extend(personId){
      const result=S.extend(state,personId);
      if(result.ok){history.length=state.time+1;history[state.time]=structuredClone(state);}
      return result;
    }
    function reserve(request){
      const result=S.addReservation(state,request);
      if(result.ok){history.length=state.time+1;history[state.time]=structuredClone(state);}
      return result;
    }
    function preview(minutes=15){
      const projected=structuredClone(state);
      // The plan knows onboard riders, never unobserved waiting or future walk-ins.
      projected.people=projected.people.filter(p=>p.kind!=='walkin'||p.status==='onboard');
      const result=[structuredClone(projected)];
      const end=Math.min(180,state.time+minutes);
      while(projected.time<end){S.step(projected);result.push(structuredClone(projected));}
      return result;
    }
    function past(minutes=15){return history.slice(Math.max(0,state.time-minutes),state.time+1).map(s=>structuredClone(s));}
    return {get state(){return state},seek,advance(n){return seek(state.time+n)},extend,reserve,preview,past};
  }
  return {create};
});
