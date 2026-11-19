(() => {
  const data = window.QCSPacketWalks;
  if (!data) return;
  const paths = {
    client: ['At LabClient: local decision', ['client']],
    server: ['At LabServer: local decision', ['server']],
    firewall: ['At FortiGate: forwarding decision', ['firewall']],
    cf: ['LabClient → FortiGate client-facing port2', ['client','firewall']],
    fc: ['FortiGate client-facing port2 → LabClient', ['firewall','client']],
    fs: ['FortiGate server-facing port3 → LabServer', ['firewall','server']],
    sf: ['LabServer → FortiGate server-facing port3', ['server','firewall']],
    cs: ['LabClient → port2 → port3 → LabServer', ['client','firewall','server']],
    sc: ['LabServer → port3 → port2 → LabClient', ['server','firewall','client']],
    deny: ['New TCP 22 request: LabClient → STOP at FortiGate', ['client','firewall']],
    stuck: ['Reply stops at LabServer route lookup', ['server']],
    dnsq: ['Concept only: client → abstract DNS resolver', ['client','dns']],
    dnsr: ['Concept only: abstract DNS resolver → client', ['dns','client']]
  };
  document.querySelectorAll('.packet-explorer').forEach(root => {
    const steps = data[root.dataset.lesson];
    let index = 0, playing = false, timer;
    const select = root.querySelector('.step-select');
    const pace = root.querySelector('.pace-select');
    const play = root.querySelector('.play-steps');
    function stop(){ playing=false;clearTimeout(timer);play.textContent='Play steps';root.classList.remove('is-playing'); }
    function render(){
      const step=steps[index];select.value=String(index);
      root.querySelector('.step-title').textContent=step.title;
      root.querySelector('.explorer-status').textContent=`Step ${index+1} of ${steps.length} • ${playing?'Playing':'Paused'}`;
      for(const key of ['ether','ip','transport','decision','why','evidence'])root.querySelector(`[data-field="${key}"]`).textContent=step[key];
      const [label,nodes]=paths[step.hop];
      const lane=root.querySelector('.hop-line');lane.replaceChildren();
      const text=document.createElement('span');text.textContent=label;lane.append(text);
      const dot=document.createElement('span');dot.className='packet-dot';dot.setAttribute('aria-hidden','true');lane.append(dot);
      lane.classList.toggle('reverse',['fc','sf','sc','dnsr'].includes(step.hop));
      lane.classList.toggle('stationary',['client','server','firewall','stuck'].includes(step.hop));
      root.classList.toggle('is-fault',['deny','stuck'].includes(step.hop));
      root.querySelectorAll('[data-node]').forEach(node=>{node.classList.toggle('active',nodes.includes(node.dataset.node));node.hidden=node.dataset.node==='dns'&&!step.hop.startsWith('dns');});
      root.querySelector('.prev-step').disabled=index===0;
      root.querySelector('.next-step').disabled=index===steps.length-1;
      root.style.setProperty('--step-time',pace.value+'ms');
      play.textContent=playing?'Pause steps':'Play steps';
      root.classList.toggle('is-playing',playing);
    }
    function schedule(){clearTimeout(timer);if(playing)timer=setTimeout(()=>{if(index===steps.length-1){stop();render();return}index++;render();schedule()},Number(pace.value));}
    function go(i){stop();index=i;render();}
    select.addEventListener('change',()=>go(Number(select.value)));
    pace.addEventListener('change',()=>{render();schedule()});
    root.querySelector('.prev-step').onclick=()=>go(Math.max(0,index-1));
    root.querySelector('.next-step').onclick=()=>go(Math.min(steps.length-1,index+1));
    root.querySelector('.reset-steps').onclick=()=>go(0);
    play.onclick=()=>{if(playing)stop();else{if(index===steps.length-1)index=0;playing=true;}render();schedule()};
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();render();}});
    render();
  });
})();
