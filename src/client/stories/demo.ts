import { PaletteOption } from "../Palette";


export function demoCompleter(value: string) {
  if (value == "") {
    return [];
  } else {
    const result: PaletteOption[] = [ { value, content: value } ];

    for (let q = 0; q < value.length; ++q) {
      result.push({
        value: `${ value } #${ q + 1 }`,
        content: `${ value } #${ q + 1 }`
      });
    }

    return result;
  }
}