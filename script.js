function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.navlinks button').forEach(b=>b.classList.toggle('active', b.dataset.page===name));
  window.scrollTo({top:0, behavior:'smooth'});
}
document.querySelectorAll('.navlinks button').forEach(b=>{
  b.addEventListener('click', ()=>showPage(b.dataset.page));
});

// chat demo state (in-memory only, resets on reload)
const rooms = {
  general: {
    title:'# general', sub:'4 members',
    messages:[
      {who:'Sara', me:false, text:'omg the sprig console arrived today'},
      {who:'Omar', me:false, text:'wait no way, what are you building with it'},
      {who:'Sara', me:false, text:'thinking a tiny platformer, will bring it thursday'},
    ]
  },
  projects: {
    title:'# show-and-tell', sub:'2 members',
    messages:[
      {who:'Omar', me:false, text:'shipped my first site last night, deployed on github pages'},
      {who:'Sara', me:false, text:"let's see it at the meeting!"},
    ]
  },
  'dm-sara': {
    title:'Sara', sub:'online',
    messages:[{who:'Sara', me:false, text:'you coming thursday?'}]
  },
  'dm-omar': {
    title:'Omar', sub:'active 2h ago',
    messages:[{who:'Omar', me:false, text:'can you bring the extra hdmi cable'}]
  }
};
let currentRoom = 'general';

function renderRoom(){
  const r = rooms[currentRoom];
  document.getElementById('chat-room-title').textContent = r.title;
  document.getElementById('chat-room-sub').textContent = r.sub;
  document.getElementById('chat-text').placeholder = 'Message ' + r.title;
  const log = document.getElementById('chat-log');
  log.innerHTML = '';
  r.messages.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'msg' + (m.me ? ' me' : '');
    div.innerHTML = '<div class="who">'+(m.me?'You':m.who)+'</div><div class="bubble"></div>';
    div.querySelector('.bubble').textContent = m.text;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}

function openRoom(name){
  currentRoom = name;
  document.querySelectorAll('.chat-item').forEach(i=>i.classList.toggle('active', i.dataset.room===name));
  renderRoom();
}

function sendMsg(){
  const input = document.getElementById('chat-text');
  const text = input.value.trim();
  if(!text) return;
  rooms[currentRoom].messages.push({who:'You', me:true, text});
  input.value = '';
  renderRoom();
}

renderRoom();
