// Sector and ownership labels follow the user's supplied reference list.
// Verify portfolio membership and ownership against the reporting-date master data.
const records=[
 ['DGPC','Druk Green Power Corporation','Energy & Resources','Owned','DGPC(1).webp'],
 ['BPC','Bhutan Power Corporation','Energy & Resources','Owned','BPC(1).webp'],
 ['NRDCL','Natural Resources Development Corporation','Energy & Resources','Owned','NRDCL(1).webp'],
 ['SMCL','State Mining Corporation','Energy & Resources','Owned','SMCL(1).webp'],
 ['BoBL','Bank of Bhutan','Financial Services','Controlled','BOB(1).webp'],
 ['BNBL','Bhutan National Bank','Financial Services','Linked','BNBL(1).webp'],
 ['RICBL','Royal Insurance Corporation of Bhutan','Financial Services','Linked','RICB(1).webp'],
 ['BDBL','Bhutan Development Bank','Financial Services','Linked','BDBL.png'],
 ['BIL','Bhutan Insurance Limited','Financial Services','Linked','BIL.png'],
 ['DCCL','Dungsam Cement Corporation','Manufacturing & Agribusiness','Controlled','DCC(1).webp'],
 ['DPL','Dungsam Polymers','Manufacturing & Agribusiness','Controlled','DPL(1).webp'],
 ['KIL','Koufuku International','Manufacturing & Agribusiness','Controlled','Koufuku(1).webp'],
 ['WCCL','Wood Craft Centre','Manufacturing & Agribusiness','Historical',null],
 ['DML','Druk Metallurgy','Manufacturing & Agribusiness','Owned','DML(1).webp'],
 ['BBPL','Bhutan Board Products','Manufacturing & Agribusiness','Linked','BPL(1).webp'],
 ['BFAL','Bhutan Ferro Alloys','Manufacturing & Agribusiness','Linked','BFAL(1).webp'],
 ['PCAL','Penden Cement Authority','Manufacturing & Agribusiness','Linked','PCAL(1).webp'],
 ['MSPCL','Menjong Sorig Pharmaceuticals Corporation','Healthcare & Pharmaceuticals','Owned','Menjong-Sorig(1).webp'],
 ['ABHL','Azista Bhutan Healthcare','Healthcare & Pharmaceuticals','Linked','ABH(1).webp'],
 ['BTL','Bhutan Telecom','Technology & Communication','Owned','BT(1).webp'],
 ['TTPL','Thimphu TechPark','Technology & Communication','Owned','TTPL(1).webp'],
 ['DIGITAL','Digital Asset / Green Mining Ventures','Technology & Communication','Partnership',null],
 ['DACL','Drukair Corporation','Communication, Transport & Trading','Owned','Drukair(1).webp'],
 ['STCBL','State Trading Corporation of Bhutan','Communication, Transport & Trading','Controlled','STCBL(1).webp'],
 ['CDCL','Construction Development Corporation','Real Estate & Infrastructure','Owned','CDCL(1).webp'],
];
export const directory=records.map(([id,name,sector,ownership,logo])=>({id,name,sector,ownership,logo:logo?`/logos/${logo}`:null,reporting:!['WCCL','DIGITAL'].includes(id),note:id==='WCCL'?'Merged into NRDCL in April 2021; historical reference.':id==='DIGITAL'?'Strategic partnership category; a legal reporting entity must be specified.':''}));
export const reportingCompanies=directory.filter(c=>c.reporting);
export const sectors=[...new Set(directory.map(c=>c.sector))];
export const companyById=id=>directory.find(c=>c.id===id)||{id,name:id,sector:'Unassigned',ownership:'Unspecified'};
