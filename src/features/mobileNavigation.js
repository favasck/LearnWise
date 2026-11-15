export function mobileDestinations(nav,role) {
  const keys=role==='parent'?['dashboard','classes','learning']:role==='student'?['dashboard','myclasses','homework','progress']:role==='tutor'?['dashboard','myclasses','mystudents']:[];
  const labels={dashboard:role==='tutor'?'Today':'Home',classes:'Lessons',myclasses:'Lessons',learning:'Learning',homework:'Homework',progress:'Progress',mystudents:'Students'};
  return keys.flatMap(key=>{const item=nav.find(item=>item.key===key);return item?[{...item,label:labels[key]}]:[];});
}
export function activeMobileDestination(current,role,destinations) {
  if(role==='parent'&&['homework','progress','mychild'].includes(current))return 'learning';
  return destinations.some(item=>item.key===current)?current:'more';
}
