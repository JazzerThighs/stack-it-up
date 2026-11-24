export function initializeTopbar(root=document) {
  const dialog=root.getElementById('qrDialog');
  root.getElementById('qrOpen').onclick=()=>{if(!dialog.open)dialog.showModal();};
  root.getElementById('qrClose').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
}
