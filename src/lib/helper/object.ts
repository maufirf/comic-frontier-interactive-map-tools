//https://dev.to/nas5w/how-to-select-or-omit-properties-from-an-object-in-javascript-3ina
export function pick<T>(obj:T, ...keys:(keyof T)[]) {
    return keys.reduce(function(result:Partial<T>, key:keyof T) {
        result[key] = obj[key];
        return result;
    }, {})
}

export function omit<T>(obj:T, ...props:(keyof T)[]) {
    const result:Partial<T> = { ...obj };
    props.forEach(function(prop) {
      delete result[prop];
    });
    return result;
  }
  