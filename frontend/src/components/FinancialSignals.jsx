import React from 'react';
import {Panel,Bars,Empty,Status,million,percent} from './UI';
export function FinancialSignals({data}){
 const flags=[];
 if(data.variancePercent<-10)flags.push(['Revenue below plan',`${percent(data.variancePercent)} variance from plan`,'Review revenue timing and business-line performance.']);
 if(data.growth<-10)flags.push(['Revenue decline',`${percent(data.growth)} versus the fixture comparison period`,'Review the source-period comparison and supporting explanations.']);
 if(data.profit<0)flags.push(['Monthly loss',million(data.profit),'Review expenses relative to revenue.']);
 if(data.efficiency>100)flags.push(['Expenses exceed revenue',`${percent(data.efficiency)} cost-to-income ratio`,'Review expense efficiency and revenue recovery.']);
 return <><Panel title="Period comparison" subtitle="Only the periods available in the selected fixture are shown">{data.trend?.length?<Bars rows={data.trend.flatMap(t=>[{label:`${t.month} revenue`,value:t.revenue},{label:`${t.month} expenses`,value:t.expenses,color:'#95aca2'}])}/>:<Empty title="No historical series in this fixture" detail="Connect the historical-data endpoint to populate this view."/>}</Panel><Panel title="Financial flags" subtitle="Illustrative frontend thresholds · not verified anomaly detection" className="spaced">{flags.length?<div className="table-scroll"><table><thead><tr><th>Flag</th><th>Evidence</th><th>Review point</th></tr></thead><tbody>{flags.map(([name,evidence,note])=><tr key={name}><td><Status status={name}/></td><td>{evidence}</td><td className="wrap-cell">{note}</td></tr>)}</tbody></table></div>:<Empty title="No fixture flags at these thresholds" detail="This does not establish the absence of financial risk."/>}</Panel></>;
}
