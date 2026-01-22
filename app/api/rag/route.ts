import { NextRequest, NextResponse } from 'next/server'

const LYZR_RAG_BASE_URL = 'https://rag-prod.studio.lyzr.ai/v3'
const LYZR_API_KEY = process.env.LYZR_API_KEY || ''

const FILE_TYPE_CONFIG: Record<string, { type: 'pdf' | 'docx' | 'txt'; parser: string }> = {
  'application/pdf': { type: 'pdf', parser: 'pypdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'docx',
    parser: 'docx2txt',
  },
  'text/plain': { type: 'txt', parser: 'txt_parser' },
}

// GET - List documents in a knowledge base
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ragId = searchParams.get('ragId')

    if (!ragId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId is required',
        },
        { status: 400 }
      )
    }

    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const response = await fetch(`${LYZR_RAG_BASE_URL}/document?rag_id=${ragId}`, {
      method: 'GET',
      headers: {
        'x-api-key': LYZR_API_KEY,
      },
    })

    if (response.ok) {
      const data = await response.json()
      const documents = (data.documents || data.data || []).map((doc: any) => ({
        id: doc.id || doc._id,
        fileName: doc.file_name || doc.fileName || doc.name,
        fileType: doc.file_type || doc.fileType || 'unknown',
        fileSize: doc.file_size || doc.fileSize,
        status: doc.status || 'active',
        uploadedAt: doc.uploaded_at || doc.createdAt,
        documentCount: doc.document_count || doc.chunks,
      }))

      return NextResponse.json({
        success: true,
        documents,
        ragId,
        timestamp: new Date().toISOString(),
      })
    } else {
      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          error: `Failed to get documents: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    )
  }
}

// POST - Upload and train a document
export async function POST(request: NextRequest) {
  try {
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const ragId = formData.get('ragId') as string
    const file = formData.get('file') as File

    if (!ragId || !file) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId and file are required',
        },
        { status: 400 }
      )
    }

    const fileConfig = FILE_TYPE_CONFIG[file.type]
    if (!fileConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Supported: PDF, DOCX, TXT`,
        },
        { status: 400 }
      )
    }

    // Step 1: Parse the document
    const parseFormData = new FormData()
    parseFormData.append('file', file, file.name)
    parseFormData.append('parser', fileConfig.parser)

    const parseResponse = await fetch(`${LYZR_RAG_BASE_URL}/document/parse`, {
      method: 'POST',
      headers: {
        'x-api-key': LYZR_API_KEY,
      },
      body: parseFormData,
    })

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text()
      return NextResponse.json(
        {
          success: false,
          error: `Failed to parse document: ${parseResponse.status}`,
          details: errorText,
        },
        { status: parseResponse.status }
      )
    }

    const parseData = await parseResponse.json()
    const documents = parseData.documents || parseData.chunks || []

    if (documents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No content extracted from document',
        },
        { status: 400 }
      )
    }

    // Step 2: Train the knowledge base with parsed content
    const trainResponse = await fetch(`${LYZR_RAG_BASE_URL}/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify({
        rag_id: ragId,
        documents: documents.map((doc: any) => ({
          content: doc.content || doc.text || doc,
          metadata: {
            file_name: file.name,
            file_type: fileConfig.type,
            ...(doc.metadata || {}),
          },
        })),
      }),
    })

    if (!trainResponse.ok) {
      const errorText = await trainResponse.text()
      return NextResponse.json(
        {
          success: false,
          error: `Failed to train knowledge base: ${trainResponse.status}`,
          details: errorText,
        },
        { status: trainResponse.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and trained successfully',
      fileName: file.name,
      fileType: fileConfig.type,
      documentCount: documents.length,
      ragId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    )
  }
}

// DELETE - Remove documents from knowledge base
export async function DELETE(request: NextRequest) {
  try {
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { ragId, documentNames } = body

    if (!ragId || !documentNames || !Array.isArray(documentNames)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId and documentNames array are required',
        },
        { status: 400 }
      )
    }

    const response = await fetch(`${LYZR_RAG_BASE_URL}/document`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify({
        rag_id: ragId,
        document_names: documentNames,
      }),
    })

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Documents deleted successfully',
        deletedCount: documentNames.length,
        ragId,
        timestamp: new Date().toISOString(),
      })
    } else {
      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          error: `Failed to delete documents: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    )
  }
}
