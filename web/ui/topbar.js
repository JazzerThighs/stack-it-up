// These surfaces keep their controls mounted so connection state survives closing.
export function initializeTopbar(root=document) {
  for(const name of ['qr','bluetooth']) {
    const dialog=root.getElementById(name+'Dialog');
    root.getElementById(name+'Open').onclick=()=>{if(!dialog.open)dialog.showModal();};
    root.getElementById(name+'Close').onclick=()=>dialog.close();
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  }
}
