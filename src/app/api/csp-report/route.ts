import { NextRequest, NextResponse } from "next/server";

/**
 * CSP violation reporting endpoint
 * Receives reports from browsers when Content Security Policy is violated
 */
export async function POST(request: NextRequest) {
  try {
    const report = await request.json();

    // CSP reports use 'csp-report' wrapper for report-uri format
    const violation = report['csp-report'];

    if (!violation) {
      return NextResponse.json(
        { error: 'Invalid CSP report format' },
        { status: 400 }
      );
    }

    // Log violation with structured format for monitoring
    console.error('CSP Violation:', {
      documentUri: violation.documentUri || violation['document-uri'],
      violatedDirective: violation.violatedDirective || violation['violated-directive'],
      blockedUri: violation.blockedUri || violation['blocked-uri'],
      sourceFile: violation.sourceFile || violation['source-file'],
      lineNumber: violation.lineNumber || violation['line-number'],
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
    });

    // Return 204 No Content (standard for report endpoints)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to process CSP report:', error);
    return NextResponse.json(
      { error: 'Failed to process report' },
      { status: 400 }
    );
  }
}
