import React from 'react';
import {Panel,Bars,Empty,Status,million,percent} from './UI';
export function FinancialSignals({data}){
 const flags=[];
 if(data.variancePercent<-10)flags.push(['Revenue below plan',`${percent(data.variancePercent)} variance from plan`,'Review revenue timing and business-line performance.']);
 if(data.growth<-10)flags.push(['Revenue decline',`${percent(data.growth)} versus the comparison period`,'Review the source-period comparison and supporting explanations.']);
 if(data.profit<0)flags.push(['Monthly loss',million(data.profit),'Review expenses relative to revenue.']);
 if(data.efficiency>100)flags.push(['Expenses exceed revenue',`${percent(data.efficiency)} cost-to-income ratio`,'Review expense efficiency and revenue recovery.']);
 return <><Panel title="Period comparison" subtitle="Revenue and expenses across available reporting periods">{data.trend?.length?<Bars rows={data.trend.flatMap(t=>[{label:`${t.month} revenue`,value:t.revenue},{label:`${t.month} expenses`,value:t.expenses,color:'#95aca2'}])}/>:<Empty title="No historical comparison available" detail="No earlier reporting periods are available for this view."/>}</Panel><Panel title="Financial flags" subtitle="Exceptions requiring financial review" className="spaced">{flags.length?<div className="table-scroll"><table><thead><tr><th>Flag</th><th>Evidence</th><th>Review point</th></tr></thead><tbody>{flags.map(([name,evidence,note])=><tr key={name}><td><Status status={name}/></td><td>{evidence}</td><td className="wrap-cell">{note}</td></tr>)}</tbody></table></div>:<Empty title="No exceptions at the selected thresholds" detail="This does not establish the absence of financial risk."/>}</Panel></>;
}
