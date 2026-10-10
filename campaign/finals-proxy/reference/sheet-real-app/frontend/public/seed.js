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

// Every EVO workbook is a separate fixture declared by a real-finals GIVEN.
(function (state) {
  let counter=0;
  const rectangle=(r0,c0,r1=r0,c1=c0)=>({r0,c0,r1,c1});
  function workbook(name,sheetName,cells={},otherSheets=[]) {
    const id='evo-workbook-'+(++counter),sheet={id:id+'-sheet-1',name:sheetName,cells,selection:rectangle(0,0),validations:[],filter:null,pivot:null};
    const result={id,name,updatedAt:'2026-10-06T11:48:00.000Z',activeSheetId:sheet.id,sheets:[sheet],namedRanges:[],filterViews:[]};
    for(const name of otherSheets) result.sheets.push({id:id+'-sheet-'+(result.sheets.length+1),name,cells:{},selection:rectangle(0,0),validations:[],filter:null,pivot:null});
    state.workbooks.push(result);return result;
  }
  workbook('EVO-M01-RENAME-OK','IdentityLog',{F3:'unreviewed'});
  workbook('EVO-M01-RENAME-DUP','IdentityLog');
  workbook('EVO-M01-ARCHIVE-RESERVED','Archive');
  workbook('EVO-M01-RENAME-LIMIT','LimitProbe',{C2:'limit sentinel'});
  workbook('EVO-M02-SHEET-OK','HarborDraft',{D5:'dock marker'},['LedgerView']);
  const duplicate=workbook('EVO-M02-SHEET-DUP','Meridian',{},['ArchiveBay']);duplicate.activeSheetId=duplicate.sheets[1].id;
  workbook('EVO-M02-SHEET-LIMIT','LengthGauge',{G4:'sheet sentinel'});
  workbook('EVO-M03-CLEAR-TEXT','Staging',{H4:'obsolete tag'});
  workbook('EVO-M03-CLEAR-FORMULA','Calculations',{B7:'13',C7:'=B7*5',D7:'=C7+2'});
  workbook('EVO-M03-CLEAR-RANGE','Matrix',{H4:'Amber',I4:'Delta',H5:'Kite',I5:'Orchid'});
  for(const action of ['SAVE','APPLY','DELETE']) {
    const w=workbook('EVO-M04-FILTER-'+action,'Workload',{
      D3:'Workstream',E3:'Phase',F3:'Load',D4:'Atlas',E4:'Queued',F4:'17',D5:'Atlas',E5:'Active',F5:'31',D6:'Beacon',E6:'Queued',F6:'22',D7:'Cirrus',E7:'Queued',F7:'9'
    });
    if(action!=='SAVE') w.filterViews.push({id:w.id+'-queued',name:'Queued lanes',sheetId:w.activeSheetId,filter:{...rectangle(2,3,6,5),conditions:[{col:4,kind:'values',values:['Queued']}]}});
  }
  const numberRule=(range)=>({id:'capacity',type:'number',range,min:25,max:75,errorMessage:'Capacity must be from 25 to 75'});
  workbook('EVO-M05-VALIDATION-FORMULA','Thresholds',{J6:'37'}).sheets[0].validations=[numberRule(rectangle(5,9))];
  workbook('EVO-M05-VALIDATION-GRID','Thresholds',{K8:'Ready'}).sheets[0].validations=[{id:'queue-state',type:'dropdown',range:rectangle(7,10),raw:'Ready, Holding, Released',values:['Ready','Holding','Released'],errorMessage:'Choose a queue state'}];
  workbook('EVO-M05-VALIDATION-EDIT','Thresholds',{L4:'42'}).sheets[0].validations=[numberRule(rectangle(3,11))];
  for(const kind of ['ROW','COLUMN','BOTH']) {
    const cells={},columns=kind==='ROW'?3:12,rows=kind==='COLUMN'?8:40;
    for(let c=0;c<columns;c++) {
      const letter=String.fromCharCode(65+c);cells[letter+'1']='Column '+letter;
      for(let r=2;r<=rows;r++) cells[letter+r]=String(r*(c+1));
    }
    workbook('EVO-N01-FREEZE-'+kind,'ScrollLedger',cells);
  }
  workbook('EVO-N02-FIND-NEXT','Narrative',{E4:'Cobalt',E7:'Cobalt',E11:'Cobalt'});
  workbook('EVO-N02-REPLACE-ALL','Narrative',{F3:'Cobalt',F6:'Cobalt',F9:'Cobalt',F12:'Copper'});
  workbook('EVO-N02-CASE-SENSITIVE','Narrative',{G3:'Cobalt',G4:'cobalt',G5:'Cobalt-7'});
  workbook('EVO-N03-NAMED-CREATE','ForecastModel',{J3:'18',J4:'24',J5:'31'});
  workbook('EVO-N03-NAMED-INVALID','ForecastModel',{K2:'6',K3:'14'});
  workbook('EVO-N03-NAMED-UPDATE','ForecastModel',{K2:'5',K3:'8',K4:'12',M2:'=SUM(MarginBase)'}).namedRanges=[{name:'MarginBase',range:'ForecastModel!K2:K3'}];
  workbook('EVO-N04-FORMAT-NUMBER','Signals',{J4:'11',J5:'29',J6:'46'});
  workbook('EVO-N04-FORMAT-TEXT','Signals',{K4:'Watch',K5:'Stable',K6:'Elevated'});
  workbook('EVO-N04-FORMAT-EDIT','Signals',{L3:'16',L4:'28',L5:'39'}).sheets[0].conditionalRules=[{range:rectangle(2,11,4,11),condition:'Greater than',value:'20',style:'Red fill'}];
  workbook('EVO-N05-NOTE-CREATE','ReviewQueue',{D8:'Manifest R41'});
  workbook('EVO-N05-NOTE-EDIT','ReviewQueue',{F6:'Gate Rho'}).sheets[0].notes={F6:'Awaiting controller sign-off'};
  workbook('EVO-N05-NOTE-DELETE','ReviewQueue',{J3:'Route Zeta'}).sheets[0].notes={J3:'Retire after audit'};
})(window.SEED);
