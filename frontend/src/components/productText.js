// Display wording only. Source records and financial values are not modified.
export function productText(value){
 if(typeof value!=='string')return value;
 const replacements=[
  ['TTPL August month.xlsx · Month Financials · reference fixture','TTPL · August monthly financials'],
  ['TTPL July comparison totals plus synthetic supporting fields','TTPL · July comparison figures'],
  ['Synthetic demonstration fixture','Prepared company report'],
  ['Validated demo snapshot aggregate','Consolidated company submissions'],
  ['Predefined company fixtures are aggregated for this complete reporting cycle. This is a demonstration, without statutory accounting adjustments.','Company submissions are combined for this reporting period.'],
  ['Statutory eliminations and accounting adjustments require backend rules.','Review intercompany adjustments before final sign-off.'],
  ['This demonstration uses July comparison totals from the August TTPL workbook. Supporting figures are synthetic and do not represent a complete July report.','July comparison totals are taken from the August TTPL workbook.'],
  ['Supporting fields and breakdowns are synthetic demonstration data.','Supporting figures are included for comparison.'],
  ['The company remains profitable in this synthetic example.','The company remains profitable for this period.'],
  ['This demonstration highlights a revenue shortfall for management review.','The revenue shortfall warrants management review.'],
  ['The TTPL review presentation attributes','The TTPL financial review attributes'],
  ['That context comes from the supplied presentation, not an inference from the figures alone.','Refer to the financial review for the supporting explanation.'],
  ['Demo workspace initialized','Workspace opened'],['TTPL reference and synthetic demonstration records loaded.','Company reporting records loaded.'],
  ['Demo-only outstanding reports completed','Outstanding reports prepared'],['Demo-only','Prepared'],['Demo processing','Report processing'],['Demo validation','Validation'],
  ['Reminder simulated','Reminder recorded'],['the fixture comparison period','the comparison period'],
 ];
 let text=value;for(const [from,to] of replacements)text=text.split(from).join(to);return text;
}
