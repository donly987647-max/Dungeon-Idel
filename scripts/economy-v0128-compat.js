/* v0.12.8 economy compatibility gate
 * v0.12.7 clients keep automatic economy completion.
 * Loading this v0.12.8 client opts the signed-in player into manual claim mode.
 */
(()=>{
  let enabling=null,enabled=false;
  async function enableManualEconomy(){
    if(enabled)return true;
    if(enabling)return enabling;
    enabling=(async()=>{
      try{
        const {data:{session}}=await sb.auth.getSession();
        if(!session)return false;
        const {error}=await sb.rpc('game_enable_manual_economy_claim');
        if(error)throw error;
        enabled=true;
        return true;
      }catch(err){
        console.warn('manual economy mode activation failed',err);
        return false;
      }finally{enabling=null}
    })();
    return enabling;
  }
  enableManualEconomy();
  sb.auth.onAuthStateChange((event,newSession)=>{
    if(event==='SIGNED_OUT'){enabled=false;return}
    if(newSession)enableManualEconomy();
  });
  window.enableManualEconomy=enableManualEconomy;
})();
