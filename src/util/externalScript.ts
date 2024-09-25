import path from 'path';
import cliState from '../cliState';
import { importModule } from '../esm';
import { runPython } from '../python/pythonUtils';
import { isJavascriptFile } from '../util';

export async function executeExternalScript(
  filePath: string,
  output: any,
  context: any,
  pythonFunctionName: string = 'get_assert',
): Promise<any> {
  const basePath = cliState.basePath || '';
  const resolvedPath = path.resolve(basePath, filePath.slice('file://'.length));

  if (isJavascriptFile(resolvedPath)) {
    const requiredModule = await importModule(resolvedPath);
    if (typeof requiredModule === 'function') {
      return await Promise.resolve(requiredModule(output, context));
    } else if (requiredModule.default && typeof requiredModule.default === 'function') {
      return await Promise.resolve(requiredModule.default(output, context));
    } else {
      throw new Error(
        `Assertion malformed: ${resolvedPath} must export a function or have a default export as a function`,
      );
    }
  } else if (resolvedPath.endsWith('.py')) {
    try {
      return await runPython(resolvedPath, pythonFunctionName, [output, context]);
    } catch (error) {
      throw new Error((error as Error).message);
    }
  } else {
    throw new Error(`Unsupported file type: ${resolvedPath}`);
  }
}
