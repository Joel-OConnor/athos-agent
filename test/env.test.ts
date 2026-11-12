import { loadDotEnv, setting } from '../src/env';

describe('loadDotEnv', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks Node to load the file it is given', () => {
    const spy = jest.spyOn(process, 'loadEnvFile').mockReturnValue(undefined);
    loadDotEnv('demo.env');
    expect(spy).toHaveBeenCalledWith('demo.env');
  });

  it('defaults to .env in the working directory', () => {
    const spy = jest.spyOn(process, 'loadEnvFile').mockReturnValue(undefined);
    loadDotEnv();
    expect(spy).toHaveBeenCalledWith('.env');
  });

  it('is a no-op when there is no file', () => {
    jest.spyOn(process, 'loadEnvFile').mockImplementation(() => {
      throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
    });
    expect(() => {
      loadDotEnv();
    }).not.toThrow();
  });

  it('still reports any other failure', () => {
    jest.spyOn(process, 'loadEnvFile').mockImplementation(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    });
    expect(() => {
      loadDotEnv();
    }).toThrow(/permission denied/);
  });
});

describe('setting', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('reads a value that is set', () => {
    process.env.NR_TEST_SETTING = 'x';
    expect(setting('NR_TEST_SETTING', 'd')).toBe('x');
  });

  it('falls back when the value is missing, and when it is blank', () => {
    delete process.env.NR_TEST_SETTING;
    expect(setting('NR_TEST_SETTING', 'd')).toBe('d');
    process.env.NR_TEST_SETTING = '';
    expect(setting('NR_TEST_SETTING', 'd')).toBe('d');
  });
});
