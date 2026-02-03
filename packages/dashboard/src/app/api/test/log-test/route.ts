/**
 * Test Endpoint: Test Pipeline Logger
 *
 * GET /api/test/log-test
 *
 * Creates test log entries to verify the logging system works.
 */

import { NextResponse } from 'next/server';
import { PipelineLogger } from '@arcvest/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const logger = new PipelineLogger('test_logging');

  logger.info('Test log entry - starting test', 'start', {
    testKey: 'testValue',
    timestamp: new Date().toISOString(),
  });

  logger.startStep();
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));

  logger.info('Test log entry - step 1 complete', 'step_1', {
    duration: 100,
  });

  logger.startStep();
  await new Promise(resolve => setTimeout(resolve, 50));

  logger.warn('Test warning entry', 'step_2', {
    warning: 'This is a test warning',
  });

  // Complete and flush logs
  await logger.complete('Test logging complete');

  return NextResponse.json({
    success: true,
    message: 'Test logs created - check /dashboard/pipeline-logs',
    runTime: logger.getElapsedMs(),
  });
}
