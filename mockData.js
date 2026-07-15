// Initial Seed Data for WorkHub Workspace Hub
// This is used to seed localStorage if no data exists.

const initialMockData = {
    files: [
        {
            id: "file_001",
            name: "260605_새한광학_정밀부품_단가표_v2.xlsx",
            extension: "xlsx",
            folder: "03_견적_및_발주",
            size: "142 KB",
            modifiedAt: "2026-06-05 11:20",
            modifiedBy: "개발담당자 (JK)",
            tags: ["단가표", "새한광학", "정밀부품", "엑셀"]
        },
        {
            id: "file_002",
            name: "260518_열화상_모듈_기술사양서_v1.pdf",
            extension: "pdf",
            folder: "02_부품_및_기술자료",
            size: "4.8 MB",
            modifiedAt: "2026-06-04 14:30",
            modifiedBy: "엔지니어링 (YS)",
            tags: ["사양서", "열화상", "도면", "PDF"]
        },
        {
            id: "file_003",
            name: "260601_동인광학_O링_발주서_최종.docx",
            extension: "docx",
            folder: "01_업체_협력사_관리",
            size: "88 KB",
            modifiedAt: "2026-06-01 09:15",
            modifiedBy: "구매팀 (MH)",
            tags: ["발주서", "동인광학", "O링", "워드"]
        },
        {
            id: "file_004",
            name: "260520_패키징_규격_도면_초안.png",
            extension: "png",
            folder: "00_Inbox",
            size: "1.2 MB",
            modifiedAt: "2026-05-20 17:45",
            modifiedBy: "개발담당자 (JK)",
            tags: ["도면", "패키징", "이미지"]
        },
        {
            id: "file_005",
            name: "251230_2025년_하반기_결산_정리.xlsx",
            extension: "xlsx",
            folder: "09_Archive",
            size: "2.1 MB",
            modifiedAt: "2025-12-30 18:00",
            modifiedBy: "회계부서 (SY)",
            tags: ["결산", "2025년", "Archive", "엑셀"]
        },
        {
            id: "file_006",
            name: "260412_이수프라텍_플라스틱_사출성형_성적서.pdf",
            extension: "pdf",
            folder: "02_부품_및_기술자료",
            size: "850 KB",
            modifiedAt: "2026-04-12 11:10",
            modifiedBy: "품질보증 (JS)",
            tags: ["성적서", "이수프라텍", "사출", "PDF"]
        },
        {
            id: "file_007",
            name: "260530_신규_협력사_미팅_보고서.docx",
            extension: "docx",
            folder: "04_내부보고서",
            size: "45 KB",
            modifiedAt: "2026-05-30 16:20",
            modifiedBy: "엔지니어링 팀장",
            tags: ["보고서", "협력사", "미팅", "워드"]
        },
        {
            id: "file_008",
            name: "260602_한성정밀_시제품_도면_V1.dwg",
            extension: "dwg",
            folder: "00_Inbox",
            size: "8.4 MB",
            modifiedAt: "2026-06-02 10:00",
            modifiedBy: "한성정밀 (외부)",
            tags: ["도면", "dwg", "시제품", "한성정밀"]
        }
    ],
    vendors: [
        {
            id: "vendor_001",
            name: "새한광학",
            code: "SH-001",
            ceo: "김새한",
            phone: "02-555-1234",
            email: "contact@saehanopt.co.kr",
            address: "서울특별시 구로구 디지털로31길 41",
            registrationNumber: "110-81-12345",
            rating: 5,
            notes: "정밀 렌즈 및 광학 모듈 가공 전문 파트너. 정밀도가 우수하며 납기 준수율이 매우 높음."
        },
        {
            id: "vendor_002",
            name: "동인광학",
            code: "DI-002",
            ceo: "박동인",
            phone: "031-777-5678",
            email: "support@donginoptics.com",
            address: "경기도 성남시 중원구 사기막골로 62",
            registrationNumber: "129-86-67890",
            rating: 4,
            notes: "기구물 가공 및 메탈 프레임 제작 협력사. O링, 볼트 등 규격 부품 조달 용이."
        },
        {
            id: "vendor_003",
            name: "이수프라텍",
            code: "IS-003",
            ceo: "이수프",
            phone: "032-888-9012",
            email: "sales@isuplatech.co.kr",
            address: "인천광역시 서구 가재울로 32",
            registrationNumber: "212-82-45678",
            rating: 4,
            notes: "엔지니어링 플라스틱 사출 성형 및 패키징 박스 전문 제작사. 금형 설계 능력 보유."
        },
        {
            id: "vendor_004",
            name: "한성정밀",
            code: "HS-004",
            ceo: "한성태",
            phone: "053-444-3322",
            email: "hs@hansung-precision.com",
            address: "대구광역시 북구 검단공단로 45",
            registrationNumber: "502-81-98765",
            rating: 3,
            notes: "정밀 CNC 밀링 및 선반 가공 업체. 시제품 가공 피드백이 빠름."
        }
    ],
    components: [
        {
            id: "comp_001",
            name: "볼록 렌즈 25mm",
            partNumber: "OPT-LN-CV25",
            drawingNumber: "SHD-2605-L25",
            material: "N-BK7 (유리)",
            vendorName: "새한광학",
            status: "최종 승인",
            description: "초점거리 50mm, 무반사 코팅(AR Coating) 처리된 정밀 볼록 렌즈."
        },
        {
            id: "comp_002",
            name: "열화상 센서 홀더",
            partNumber: "MECH-HD-TH01",
            drawingNumber: "DID-2604-HD01",
            material: "알루미늄 6061-T6",
            vendorName: "동인광학",
            status: "검토 중",
            description: "센서 조립용 정밀 메탈 프레임, 아노다이징 표면 처리 필요."
        },
        {
            id: "comp_003",
            name: "방수 실리콘 O링",
            partNumber: "SEAL-OR-085",
            drawingNumber: "DID-2605-OR85",
            material: "실리콘 고무 (Black)",
            vendorName: "동인광학",
            status: "최종 승인",
            description: "경도 70A, 외경 85mm 두께 2mm 방수 씰링용 O-Ring."
        },
        {
            id: "comp_004",
            name: "모듈 패키지 케이스",
            partNumber: "PLAS-CS-M03",
            drawingNumber: "ISD-2511-CS03",
            material: "ABS 플라스틱",
            vendorName: "이수프라텍",
            status: "개정 필요",
            description: "사출 성형용 외부 케이스, 치수 변경으로 도면 개정 진행중."
        }
    ],
    orders: [
        {
            id: "order_001",
            title: "새한광학 - 렌즈 모듈 2차",
            vendorName: "새한광학",
            amount: 4500000,
            status: "in_progress",
            deliveryDate: "2026-06-15",
            itemsCount: 2,
            description: "볼록 렌즈 25mm 및 초점 배율 조절 링 발주 건."
        },
        {
            id: "order_002",
            title: "동인광학 - O링/볼트 5,000ea",
            vendorName: "동인광학",
            amount: 850000,
            status: "pending_approval",
            deliveryDate: "2026-06-08",
            itemsCount: 1,
            description: "정밀 가공 O링 및 고장력 육각 볼트 긴급 발주 요청건."
        },
        {
            id: "order_003",
            title: "이수프라텍 - 패키징 박스",
            vendorName: "이수프라텍",
            amount: 1200000,
            status: "completed",
            deliveryDate: "2026-06-04",
            itemsCount: 1,
            description: "완제품 패키징 종이 박스 및 스폰지 완충재 1,000 세트 납품 완료."
        }
    ],
    recurringTasks: []
};

window.initialMockData = initialMockData;
