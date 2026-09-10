/* v0.13.15 — compact account/settings menu */
(()=>{
  window.menuModal=function(){
    if(!S)return;
    modal(`<div class="sheet-head"><div><div class="section-kicker">SYSTEM MENU</div><h2>메뉴</h2><p>게임 설정과 계정 관리</p></div><button class="close-btn" data-action="close">×</button></div><div class="menu-actions compact-system-menu"><button data-system-settings="1">설정</button><button class="logout" data-action="logout">로그아웃</button></div>`,'menu-sheet system-menu-sheet');
  };

  window.settingsModal=function(){
    modal(`<div class="sheet-head"><div><div class="section-kicker">SETTINGS</div><h2>설정</h2></div><button class="close-btn" data-action="close">×</button></div><div class="settings-empty-panel" aria-label="설정 항목 준비 중"></div>`,'settings-sheet');
  };

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-system-settings]');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    settingsModal();
  },true);
})();
