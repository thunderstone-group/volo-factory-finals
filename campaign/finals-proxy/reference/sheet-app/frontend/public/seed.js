// Initial records for the Online Spreadsheet Data Workspace.
// Only records explicitly required by a GIVEN clause live here; everything a user creates later
// (workbooks, worksheets, filters, validation rules, pivot tables) is created at runtime through the UI.
window.SEED = {
  session: null,
  workbooks: [
    {
      id: 'wb-q3-sales',
      name: 'Q3 Sales',
      updatedAt: '2024-10-01T09:15:00.000Z',
      activeSheetId: 'sh-q3-1',
      sheets: [
        {
          id: 'sh-q3-1',
          name: 'Sheet1',
          cells: { A1: 'Region' },
          selection: { r0: 0, c0: 0, r1: 0, c1: 0 },
          validations: [],
          filter: null,
          pivot: null
        },
        {
          id: 'sh-q3-2',
          name: 'Sheet2',
          cells: { A1: 'Item', B1: 'Qty', A2: 'Pen', B2: '4' },
          selection: { r0: 0, c0: 0, r1: 0, c1: 0 },
          validations: [],
          filter: null,
          pivot: null
        }
      ]
    }
  ]
};

// Per-scenario workbooks from the evolution GIVEN clauses.
(function(s) {
  function sh(id,name,cells={},extra={}){return {id,name,cells,selection:{r0:0,c0:0,r1:0,c1:0},validations:[],filter:null,pivot:null,rowCount:100,columnCount:26,...extra};}
  function book(ev,title,cells={},other=[],extra={}){const id='workbook-'+ev,first=sh(id+':sheet1','Sheet1',cells);const w={id,name:title+' '+ev,updatedAt:'2030-01-01T00:00:00.000Z',activeSheetId:first.id,sheets:[first,...other],namedRanges:[],...extra};s.workbooks.push(w);return w;}
  book('EV-1.1','Calculate',{A1:'12'});
  book('EV-1.2','Count',{A1:'5',A2:'10',A3:'15',A4:'20'});
  book('EV-1.3','Sum',{A1:'East',A2:'West',A3:'East',B1:'12',B2:'99',B3:'8'});
  book('EV-1.4','Recover',{A1:'0',C1:'=1/0'});
  book('EV-1.5','Recalculate',{A1:'10'},[sh('rates-EV-1.5','Rates',{A1:'2'})]);
  book('EV-1.6','Sort',{A1:'Team',B1:'Score',A2:'Blue',B2:'5',A3:'Red',B3:'3',A4:'Blue',B4:'9',D1:'Sentinel'});
  book('EV-1.7','Allow',{A1:'5'});
  book('EV-1.8','Paste',{A1:'7',B1:'=A1*2'});
  book('EV-1.9','Undo',{A1:'Preserved'});
  book('EV-1.10','Concatenate',{A1:'Order',B1:'42'});
  book('EV-2.1','Create',{A1:'2',A2:'3',A3:'5'});
  for(const [ev,title] of [['EV-2.2','Rename'],['EV-2.3','Delete']]){const w=book(ev,title,{A1:'4',A2:'6',B1:'=SUM(Revenue)'});w.namedRanges.push({id:'revenue-'+ev,name:'Revenue',sheetId:w.sheets[0].id,range:'A1:A2'});}
  book('EV-2.4','Find',{A1:'alpha',B2:'Alpha',C3:'ALPHA'});
  book('EV-2.5','Replace',{A1:'cat',A2:'catfish',A3:'dog'},[sh('other-EV-2.5','Other',{A1:'cat'})]);
  book('EV-2.6','Replace',{A1:'2',A2:'5',B1:'=A1*2',B2:'=A1+1'});
  const dup=book('EV-2.7','Duplicate',{A1:'5',B1:'=A1*2'});dup.sheets[0].validations.push({id:'validation-EV-2.7',type:'number',range:{r0:0,c0:0,r1:0,c1:0},min:0,max:10,invalidAction:'Reject input'});
  book('EV-2.8','Hide',{A1:'Current'},[sh('archive-EV-2.8','Archive',{A1:'Retained'})],{activeSheetId:'archive-EV-2.8'});
  book('EV-2.9','Show',{A1:'Current'},[sh('archive-EV-2.9','Archive',{A1:'Retained'},{hidden:true})]);
  book('EV-2.10','Move',{},[sh('second-EV-2.10','Second'),sh('third-EV-2.10','Third',{A1:'Third data'})],{activeSheetId:'third-EV-2.10'});
  book('EV-3.1','Attach',{A1:'42'});
  book('EV-3.2','Edit',{A1:'42'}).sheets[0].notes={A1:'Old note EV-3.2'};
  book('EV-3.3','Trim',{A1:'  North   East  ',A2:'  West  ',B1:'  Outside  '});
  book('EV-3.4','Split',{A1:'red,green,blue',A2:'one,,three',D1:'Outside'});
  book('EV-3.5','Remove',{A1:'Name',B1:'Count',A2:'Apple',B2:'2',A3:'Pear',B3:'3',A4:'Apple',B4:'2',D4:'Outside'});
  book('EV-3.6','Freeze',{A1:'Header'},[sh('other-EV-3.6','Other',{A1:'Other data'})]);
  book('EV-3.7','Hide',{A1:'2',B1:'8',C1:'=A1+B1'});
  book('EV-3.8','Show',{A1:'2',B1:'8',C1:'=A1+B1'}).sheets[0].hiddenCols=[1];
  book('EV-3.9','Toggle',{A1:'3',B1:'=A1*4'});
  book('EV-3.10','Make',{A1:'6',B1:'=A1*3'});
})(window.SEED);
