(function(){
  'use strict';
  const api=window.TwoDoors,$=id=>document.getElementById(id),params=new URLSearchParams(location.search);
  let diagnosis=api.createDiagnosis({placement:params.get('placement')||'direct'});
  const screens=['intro','question','result'];
  function show(id){screens.forEach(name=>$(name).hidden=name!==id);window.scrollTo({top:0,behavior:'smooth'});}
  function renderQuestion(){
    const state=diagnosis.getState(),q=api.QUESTIONS[state.questionIndex],current=state.questionIndex+1;
    $('progress-text').textContent=`${current} / ${api.QUESTIONS.length}`;
    $('progress-bar').style.width=`${current/api.QUESTIONS.length*100}%`;
    document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',current);
    $('question-title').textContent=q.title;$('question-hint').textContent=q.hint;
    $('options').replaceChildren(...q.options.map((option,index)=>{
      const button=document.createElement('button');button.type='button';button.className='option';button.dataset.value=option.value;
      const number=document.createElement('span');number.textContent=String(index+1);button.append(number,document.createTextNode(option.label));
      button.addEventListener('click',()=>{const next=diagnosis.answer(option.value);next.phase==='result'?renderResult(next.result):renderQuestion();});return button;
    }));
    $('back-btn').hidden=state.questionIndex===0;$('live-status').textContent=`전체 12문항 중 ${current}번째 질문`;$('question-title').focus({preventScroll:true});
  }
  function list(id,items){$(id).replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));}
  function renderResult(r){
    $('result-letter').textContent=r.type;$('result-title').textContent=r.title;$('result-summary').textContent=r.summary;
    $('current-law-result').textContent=`현행법 기본 결과: ${r.currentLawResult.type} · ${r.currentLawResult.title}`;
    $('inheritance-ready').textContent=r.inheritance.readiness;$('inheritance-reason').textContent=r.inheritance.reason;
    $('gift-ready').textContent=r.gift.readiness;$('gift-reason').textContent=r.gift.reason;$('time-gap').textContent=r.timeGap;
    list('blockers',r.blockers);list('documents',r.documents);$('next-action').textContent=r.nextAction;
    $('supplemental-status').textContent=`${r.supplementalBenefit.status} · `;
    $('supplemental-signals').textContent=r.supplementalBenefit.signals.length?`정비 신호: ${r.supplementalBenefit.signals.join(' · ')}`:'지정 정비 신호 없음';
    $('supplemental-copy').textContent=r.supplementalBenefit.copy;$('supplemental-limits').textContent=r.supplementalBenefit.limits;
    $('monitoring-panel').hidden=!r.monitoring.selected;$('monitoring-notice').textContent=r.monitoring.notice;
    show('result');$('result-title').focus({preventScroll:true});
  }
  $('start-btn').addEventListener('click',()=>{diagnosis.start();show('question');renderQuestion();});
  $('back-btn').addEventListener('click',()=>{diagnosis.back();renderQuestion();});
  $('restart-btn').addEventListener('click',()=>{diagnosis=api.createDiagnosis({placement:params.get('placement')||'direct'});show('intro');$('start-btn').focus();});
})();
