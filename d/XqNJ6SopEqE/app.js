(function(root,factory){
  const data = typeof module !== 'undefined' && module.exports ? require('./offer-data.js') : root.TWO_DOORS_OFFER_DATA;
  const api = factory(data);
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  if(root) root.TwoDoors=api;
})(typeof window !== 'undefined' ? window : null, function(OFFER){
  'use strict';
  if(!OFFER) throw new Error('canonical offer data is required');
  const META=Object.freeze({source_video_id:OFFER.identity.video_id,content_id:OFFER.identity.content_id,offer_id:OFFER.identity.offer_id,diagnosis_version:OFFER.identity.diagnosis_version});
  const PLACEMENTS=['description','fixed_comment','qr','card','end_screen','direct'];
  const QUESTIONS=OFFER.questions.map(q=>({id:q.id,title:q.title,hint:q.help,options:q.options.map(o=>({value:o.id,label:o.label}))}));
  const DEFAULT_BLOCKERS=['현행법 요건별 증빙 확인','상속·증여 사후관리 분리 점검','세무사·변호사 개별 사실관계 검토'];

  function selectedOptions(answers){
    if(!Array.isArray(answers)||answers.length!==QUESTIONS.length) throw new Error('12개 응답이 필요합니다.');
    return OFFER.questions.map((q,i)=>{
      const option=q.options.find(o=>o.id===answers[i]);
      if(!option) throw new Error(`${q.id}의 올바른 선택지가 아닙니다.`);
      return option;
    });
  }
  function pathState(options,path){
    const states=options.map(o=>o.paths&&o.paths[path]).filter(s=>s&&s!=='neutral');
    if(states.includes('fail')) return 'fail';
    if(states.includes('unknown')) return 'unknown';
    return 'pass';
  }
  function readiness(state){ return state==='pass'?'초록 · 우선 검토 가능':state==='unknown'?'노랑 · 확인 후 검토':'빨강 · 선행정비 우선'; }
  function reason(path,state){
    const name=path==='inheritance'?'상속':'증여';
    const duty=path==='inheritance'?'상속 전용 5년 사후관리':'증여 전용 5년 사후관리';
    if(state==='pass') return `${name} 현행법 필수 게이트와 ${duty} 계획이 모두 확인됐습니다. 적용 확정은 아닙니다.`;
    if(state==='unknown') return `${name} 필수요건 또는 ${duty} 항목에 확인 필요가 있어 초록 표시를 차단했습니다.`;
    return `${name} 필수요건 또는 ${duty} 항목에 미충족·정비 신호가 있습니다.`;
  }
  function blockers(options){
    const found=[];
    options.forEach(o=>{ if(o.blocker&&!found.includes(o.blocker)) found.push(o.blocker); });
    DEFAULT_BLOCKERS.forEach(x=>{if(!found.includes(x)) found.push(x);});
    return found.slice(0,3);
  }
  function supplementalBenefit(options){
    const benefit=OFFER.supplemental_benefit;
    const signals=[];
    OFFER.questions.forEach((question,index)=>{
      const qualifying=(benefit.qualifying_options[question.gate]||[]).includes(options[index].id);
      if(qualifying) signals.push(benefit.signal_labels[question.gate]);
    });
    return {
      eligible:signals.length>0,
      status:signals.length>0?'안내 대상':'현재 신호 없음',
      signals,
      copy:signals.length>0?benefit.eligible_copy:benefit.ineligible_copy,
      generalCopy:benefit.copy,
      limits:benefit.limits
    };
  }
  function classifyAnswers(answers){
    const options=selectedOptions(answers);
    const unknownCount=options.slice(0,11).filter(o=>o.status==='unknown'||o.status==='mixed'&&Object.values(o.paths||{}).includes('unknown')).length;
    const inheritanceState=pathState(options,'inheritance');
    const giftState=pathState(options,'gift');
    let currentType;
    if(unknownCount>=OFFER.branch_policy.critical_unknown_count_forces_d) currentType='D';
    else if(inheritanceState==='pass'&&giftState==='pass') currentType='A';
    else if(giftState==='pass') currentType='B';
    else if(inheritanceState==='pass') currentType='C';
    else currentType='D';
    const currentLawResult={type:currentType,...OFFER.results[currentType]};
    const monitoringSelected=Boolean(options[11].monitoring);
    const publicType=monitoringSelected?'E':currentType;
    const copy=OFFER.results[publicType];
    return {
      type:publicType,title:copy.title,summary:copy.summary,nextAction:copy.next_action||copy.nextAction,
      currentLawResult,
      inheritance:{readiness:readiness(inheritanceState),reason:reason('inheritance',inheritanceState),state:inheritanceState},
      gift:{readiness:readiness(giftState),reason:reason('gift',giftState),state:giftState},
      timeGap:currentType==='A'?'두 문을 같은 기준일로 병행 비교':currentType==='B'?'증여 검토 신호 우선':currentType==='C'?'상속 검토 신호 우선':'확인·정비 후 두 문 재비교',
      blockers:blockers(options),documents:OFFER.documents.slice(),
      supplementalBenefit:supplementalBenefit(options),
      monitoring:{selected:monitoringSelected,status:OFFER.monitoring.status,notice:monitoringSelected?OFFER.monitoring.notice:'정부안 모니터링을 선택하지 않았습니다.'}
    };
  }
  function makeAttribution(placement){return {...META,placement:PLACEMENTS.includes(placement)?placement:'direct'};}
  function createDiagnosis({placement='direct'}={}){
    let state={phase:'intro',questionIndex:-1,answers:[],result:null,attribution:makeAttribution(placement),startedAt:null,completedAt:null};
    return {
      start(){state={...state,phase:'question',questionIndex:0,startedAt:new Date().toISOString()};return this.getState();},
      answer(value){
        if(state.phase!=='question') throw new Error('진단이 진행 중이 아닙니다.');
        const q=QUESTIONS[state.questionIndex]; if(!q.options.some(o=>o.value===value)) throw new Error('올바른 선택지가 아닙니다.');
        const answers=state.answers.concat(value);
        state=answers.length===QUESTIONS.length?{...state,phase:'result',answers,result:classifyAnswers(answers),completedAt:new Date().toISOString()}:{...state,answers,questionIndex:state.questionIndex+1};
        return this.getState();
      },
      back(){if(state.phase==='question'&&state.questionIndex>0) state={...state,questionIndex:state.questionIndex-1,answers:state.answers.slice(0,-1)};return this.getState();},
      getState(){return JSON.parse(JSON.stringify(state));}
    };
  }
  function createReportRequest(input={}){
    if(!input.requested) return {requested:false};
    const phone=String(input.phone||'').trim(),email=String(input.email||'').trim();
    if(!phone&&!email) throw new Error('전화 또는 이메일 중 하나를 입력해 주세요.');
    if(!input.consent) throw new Error('개인정보 수집·이용 동의가 필요합니다.');
    return {requested:true,company:String(input.company||'').trim(),name:String(input.name||'').trim(),phone,email,consent:true};
  }
  return {QUESTIONS,classifyAnswers,createDiagnosis,createReportRequest,makeAttribution,META};
});
