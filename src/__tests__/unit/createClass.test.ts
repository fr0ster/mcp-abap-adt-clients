/**
 * Unit tests for createClass
 */

import { createClass, CreateClassParams } from '../../core/class/create';
import { createMockConnection, createMockAxiosError, mockAssertions } from '../helpers/mockConnection';

const { getEnabledTestCase } = require('../../../tests/test-helper');

describe('createClass', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
  });

  afterEach(() => {
    mockConnection.reset();
  });

  describe('Basic class creation', () => {
    it('should create class with minimum required parameters', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) {
        console.log('Test case "basic_class" is disabled or not found');
        return;
      }

      // Mock успішну відповідь для всього workflow
      mockConnection.mockResponse({
        status: 200,
        data: '<class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" />',
        headers: { 'sap-adt-lockhandle': 'test-lock-handle' }
      });

      const params: CreateClassParams = {
        class_name: testCase.params.class_name,
        package_name: testCase.params.package_name,
        description: testCase.params.description,
      };

      const response = await createClass(mockConnection, params);

      expect(response).toBeDefined();
      const requests = mockConnection.getAllRequests();
      expect(requests.length).toBeGreaterThan(0);
    });

    it('should create class with superclass and final flag', async () => {
      const testCase = getEnabledTestCase('create_class', 'class_with_superclass');
      if (!testCase) {
        console.log('Test case "class_with_superclass" is disabled or not found');
        return;
      }

      mockConnection.mockResponse({
        status: 200,
        data: '<class:abapClass />',
        headers: { 'sap-adt-lockhandle': 'test-lock-handle' }
      });

      await createClass(mockConnection, {
        class_name: testCase.params.class_name,
        package_name: testCase.params.package_name,
        description: testCase.params.description,
        superclass: testCase.params.superclass,
        final: testCase.params.final,
      });

      const requests = mockConnection.getAllRequests();
      expect(requests.length).toBeGreaterThan(0);

      // Знаходимо POST запит на створення класу
      const createRequest = requests.find(r => r.method === 'POST' && r.url.includes('/sap/bc/adt/oo/classes'));
      expect(createRequest).toBeDefined();

      const data = createRequest?.data as string;
      expect(data).toBeDefined();
      expect(data).toContain(testCase.params.class_name);
      if (testCase.params.superclass) {
        expect(data).toContain(testCase.params.superclass);
      }
      if (testCase.params.final) {
        expect(data).toContain('final');
      }
    });
  });

  describe('Error handling', () => {
    it('should throw error on invalid parameters', async () => {
      const testCase = getEnabledTestCase('create_class', 'basic_class');
      if (!testCase) return;

      const error = createMockAxiosError(
        400,
        'Bad Request',
        '<error>Invalid request</error>'
      );
      mockConnection.mockError(error);

      await expect(
        createClass(mockConnection, {
          class_name: testCase.params.class_name,
          package_name: 'INVALID_PACKAGE',
          description: testCase.params.description,
        })
      ).rejects.toThrow();
    });
  });
});
