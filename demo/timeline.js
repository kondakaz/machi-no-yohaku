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
    return {get state(){return state},seek,advance(n){return seek(state.time+n)},extend};
  }
  return {create};
});
