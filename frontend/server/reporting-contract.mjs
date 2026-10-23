// Small validator for the JSON Schema keywords used by these contracts.
export function validateContract(value, schema, root=schema, path='$') {
 if(schema.$ref){const target=schema.$ref.split('/').slice(1).reduce((v,k)=>v?.[k],root);if(!target)throw new Error('Unknown schema reference');return validateContract(value,target,root,path);}
 if(schema.anyOf){if(!schema.anyOf.some(s=>validateContract(value,s,root,path).length===0))return [`${path}: invalid value`];return [];}
 const errors=[];const types=Array.isArray(schema.type)?schema.type:[schema.type];
 if(schema.type&&!types.some(t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):t==='integer'?Number.isInteger(value):typeof value===t))return [`${path}: invalid type`];
 if(schema.const!==undefined&&value!==schema.const)errors.push(`${path}: unexpected value`);
 if(schema.enum&&!schema.enum.includes(value))errors.push(`${path}: invalid choice`);
 if(typeof value==='string'){if(schema.minLength&&value.length<schema.minLength)errors.push(`${path}: required`);if(schema.maxLength&&value.length>schema.maxLength)errors.push(`${path}: too long`);if(schema.pattern&&!new RegExp(schema.pattern).test(value))errors.push(`${path}: invalid format`);}
 if(Array.isArray(value)){if(schema.minItems&&value.length<schema.minItems)errors.push(`${path}: too few items`);if(schema.maxItems&&value.length>schema.maxItems)errors.push(`${path}: too many items`);value.forEach((v,i)=>errors.push(...validateContract(v,schema.items||{},root,`${path}[${i}]`)));}
 if(value&&typeof value==='object'&&!Array.isArray(value)){for(const key of schema.required||[])if(!(key in value))errors.push(`${path}.${key}: required`);for(const [k,v] of Object.entries(value)){if(schema.properties?.[k])errors.push(...validateContract(v,schema.properties[k],root,`${path}.${k}`));else if(schema.additionalProperties===false)errors.push(`${path}.${k}: unknown field`);}}
 return errors;
}
