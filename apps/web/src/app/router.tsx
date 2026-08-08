// app/router.tsx
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../core/auth/AuthContext';
import { RequirePermission } from '../core/rbac/RequirePermission';
import { AppLayout } from './AppLayout';
import { LoginPage } from '../modules/organizations/pages/LoginPage';
import { SignUpPage } from '../modules/organizations/pages/SignUpPage';
import { OrganizationSettingsPage } from '../modules/organizations/pages/OrganizationSettingsPage';
import { SchoolsPage } from '../modules/organizations/pages/SchoolsPage';
import { UsersPage } from '../modules/organizations/pages/UsersPage';
import { AuditLogsPage } from '../modules/organizations/pages/AuditLogsPage';
import { DashboardPage } from '../modules/dashboard/pages/DashboardPage';
import { AcademicSetupPage } from '../modules/academics/pages/AcademicSetupPage';
import { StudentsListPage } from '../modules/students/pages/StudentsListPage';
import { StudentDetailPage } from '../modules/students/pages/StudentDetailPage';
import { ApplicationsPage } from '../modules/admissions/pages/ApplicationsPage';
import { ApplicationDetailPage } from '../modules/admissions/pages/ApplicationDetailPage';
import { MarkAttendancePage } from '../modules/attendance/pages/MarkAttendancePage';
import { AttendanceReportsPage } from '../modules/attendance/pages/AttendanceReportsPage';
import { EmployeesPage } from '../modules/teachers-hr/pages/EmployeesPage';
import { EmployeeDetailPage } from '../modules/teachers-hr/pages/EmployeeDetailPage';
import { LeaveManagementPage } from '../modules/teachers-hr/pages/LeaveManagementPage';
import { PeriodsSetupPage } from '../modules/timetable/pages/PeriodsSetupPage';
import { SectionTimetablePage } from '../modules/timetable/pages/SectionTimetablePage';
import { MyTimetablePage } from '../modules/timetable/pages/MyTimetablePage';
import { ExamsListPage } from '../modules/examinations/pages/ExamsListPage';
import { ExamDetailPage } from '../modules/examinations/pages/ExamDetailPage';
import { MarksEntryPage } from '../modules/examinations/pages/MarksEntryPage';
import { QuestionBankPage } from '../modules/examinations/pages/QuestionBankPage';
import { RankingsPage } from '../modules/examinations/pages/RankingsPage';
import { ReportCardPage } from '../modules/examinations/pages/ReportCardPage';
import { FeeSetupPage } from '../modules/fees-finance/pages/FeeSetupPage';
import { InvoicesPage } from '../modules/fees-finance/pages/InvoicesPage';
import { InvoiceDetailPage } from '../modules/fees-finance/pages/InvoiceDetailPage';
import { FinancialReportsPage } from '../modules/fees-finance/pages/FinancialReportsPage';
import { CatalogPage } from '../modules/library/pages/CatalogPage';
import { BookDetailPage } from '../modules/library/pages/BookDetailPage';
import { CirculationPage } from '../modules/library/pages/CirculationPage';
import { ItemsPage } from '../modules/inventory/pages/ItemsPage';
import { SuppliersPage } from '../modules/inventory/pages/SuppliersPage';
import { PurchaseOrdersPage } from '../modules/inventory/pages/PurchaseOrdersPage';
import { PurchaseOrderDetailPage } from '../modules/inventory/pages/PurchaseOrderDetailPage';
import { BuildingsPage } from '../modules/hostel/pages/BuildingsPage';
import { BuildingDetailPage } from '../modules/hostel/pages/BuildingDetailPage';
import { VisitorsPage } from '../modules/hostel/pages/VisitorsPage';
import { MessMenuPage } from '../modules/hostel/pages/MessMenuPage';
import { VehiclesPage } from '../modules/transport/pages/VehiclesPage';
import { RoutesPage } from '../modules/transport/pages/RoutesPage';
import { RouteDetailPage } from '../modules/transport/pages/RouteDetailPage';
import { PortalLayout } from '../modules/portals/components/PortalLayout';
import { PortalHomePage } from '../modules/portals/pages/PortalHomePage';
import { PortalAttendancePage } from '../modules/portals/pages/PortalAttendancePage';
import { PortalFeesPage } from '../modules/portals/pages/PortalFeesPage';
import { PortalExamsPage } from '../modules/portals/pages/PortalExamsPage';
import { PortalTimetablePage } from '../modules/portals/pages/PortalTimetablePage';
import { PortalNoticesPage } from '../modules/portals/pages/PortalNoticesPage';
import { ReportsHubPage } from '../modules/reports/pages/ReportsHubPage';
import { RiskScoresPage } from '../modules/ai-copilot/pages/RiskScoresPage';
import { DocumentScannerPage } from '../modules/ai-copilot/pages/DocumentScannerPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="full-page-loader">Loading…</div>;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />

      <Route
        path="/portal"
        element={
          <RequireAuth>
            <RequirePermission anyOf={['portal.student_access', 'portal.parent_access']}>
              <PortalLayout />
            </RequirePermission>
          </RequireAuth>
        }
      >
        <Route index element={<PortalHomePage />} />
        <Route path="attendance" element={<PortalAttendancePage />} />
        <Route path="fees" element={<PortalFeesPage />} />
        <Route path="exams" element={<PortalExamsPage />} />
        <Route path="timetable" element={<PortalTimetablePage />} />
        <Route path="notices" element={<PortalNoticesPage />} />
      </Route>

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route
          path="settings/organization"
          element={
            <RequirePermission perm="organization.update">
              <OrganizationSettingsPage />
            </RequirePermission>
          }
        />

        <Route
          path="settings/schools"
          element={
            <RequirePermission perm="schools.manage">
              <SchoolsPage />
            </RequirePermission>
          }
        />
        <Route
          path="settings/users"
          element={
            <RequirePermission perm="users.manage">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="settings/audit-logs"
          element={
            <RequirePermission perm="audit_logs.view">
              <AuditLogsPage />
            </RequirePermission>
          }
        />

        {/* settings/roles (the role/permission matrix editor described in
            docs/05-roles-permissions-matrix.md) needs a dedicated editor UI
            for the roles x permissions grid — larger than the other Phase 2
            list pages, so it ships as the first item of the Phase 2 follow-up
            rather than being squeezed in here. Tracked, not forgotten. */}

        <Route
          path="academics/setup"
          element={
            <RequirePermission perm="academics.manage">
              <AcademicSetupPage />
            </RequirePermission>
          }
        />

        <Route
          path="students"
          element={
            <RequirePermission perm="students.view">
              <StudentsListPage />
            </RequirePermission>
          }
        />
        <Route
          path="students/:id"
          element={
            <RequirePermission perm="students.view">
              <StudentDetailPage />
            </RequirePermission>
          }
        />

        <Route
          path="admissions"
          element={
            <RequirePermission perm="admissions.view">
              <ApplicationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="admissions/:id"
          element={
            <RequirePermission perm="admissions.view">
              <ApplicationDetailPage />
            </RequirePermission>
          }
        />

        <Route
          path="attendance/mark"
          element={
            <RequirePermission perm="attendance.mark">
              <MarkAttendancePage />
            </RequirePermission>
          }
        />
        <Route
          path="attendance/reports"
          element={
            <RequirePermission perm="attendance.view">
              <AttendanceReportsPage />
            </RequirePermission>
          }
        />

        <Route
          path="hr/employees"
          element={
            <RequirePermission perm="hr.manage">
              <EmployeesPage />
            </RequirePermission>
          }
        />
        <Route
          path="hr/employees/:profileId"
          element={
            <RequirePermission perm="hr.manage">
              <EmployeeDetailPage />
            </RequirePermission>
          }
        />
        <Route path="hr/leave" element={<LeaveManagementPage />} />

        <Route
          path="timetable/periods"
          element={
            <RequirePermission perm="timetable.manage">
              <PeriodsSetupPage />
            </RequirePermission>
          }
        />
        <Route
          path="timetable/sections"
          element={
            <RequirePermission perm="timetable.manage">
              <SectionTimetablePage />
            </RequirePermission>
          }
        />
        <Route path="timetable/my" element={<MyTimetablePage />} />

        <Route
          path="exams"
          element={
            <RequirePermission perm="exams.view">
              <ExamsListPage />
            </RequirePermission>
          }
        />
        <Route
          path="exams/:id"
          element={
            <RequirePermission perm="exams.view">
              <ExamDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="exams/marks/:scheduleId"
          element={
            <RequirePermission perm="exams.enter_marks">
              <MarksEntryPage />
            </RequirePermission>
          }
        />
        <Route
          path="exams/:examId/rankings"
          element={
            <RequirePermission perm="exams.view">
              <RankingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="exams/:examId/report-card/:studentId"
          element={
            <RequirePermission perm="exams.view">
              <ReportCardPage />
            </RequirePermission>
          }
        />
        <Route
          path="exams/question-bank"
          element={
            <RequirePermission perm="exams.manage_question_bank">
              <QuestionBankPage />
            </RequirePermission>
          }
        />

        <Route
          path="fees/setup"
          element={
            <RequirePermission perm="fees.manage">
              <FeeSetupPage />
            </RequirePermission>
          }
        />
        <Route
          path="fees/invoices"
          element={
            <RequirePermission perm="fees.view">
              <InvoicesPage />
            </RequirePermission>
          }
        />
        <Route
          path="fees/invoices/:id"
          element={
            <RequirePermission perm="fees.view">
              <InvoiceDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="fees/reports"
          element={
            <RequirePermission perm="fees.view_reports">
              <FinancialReportsPage />
            </RequirePermission>
          }
        />

        <Route
          path="library/catalog"
          element={
            <RequirePermission perm="library.view">
              <CatalogPage />
            </RequirePermission>
          }
        />
        <Route
          path="library/books/:id"
          element={
            <RequirePermission perm="library.view">
              <BookDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="library/circulation"
          element={
            <RequirePermission perm="library.manage">
              <CirculationPage />
            </RequirePermission>
          }
        />

        <Route
          path="inventory/items"
          element={
            <RequirePermission perm="inventory.view">
              <ItemsPage />
            </RequirePermission>
          }
        />
        <Route
          path="inventory/suppliers"
          element={
            <RequirePermission perm="inventory.manage">
              <SuppliersPage />
            </RequirePermission>
          }
        />
        <Route
          path="inventory/purchase-orders"
          element={
            <RequirePermission perm="inventory.manage">
              <PurchaseOrdersPage />
            </RequirePermission>
          }
        />
        <Route
          path="inventory/purchase-orders/:id"
          element={
            <RequirePermission perm="inventory.manage">
              <PurchaseOrderDetailPage />
            </RequirePermission>
          }
        />

        <Route
          path="hostel/buildings"
          element={
            <RequirePermission perm="hostel.view">
              <BuildingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="hostel/buildings/:id"
          element={
            <RequirePermission perm="hostel.view">
              <BuildingDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="hostel/visitors"
          element={
            <RequirePermission perm="hostel.manage">
              <VisitorsPage />
            </RequirePermission>
          }
        />
        <Route path="hostel/mess-menu" element={<MessMenuPage />} />

        <Route
          path="transport/vehicles"
          element={
            <RequirePermission perm="transport.manage">
              <VehiclesPage />
            </RequirePermission>
          }
        />
        <Route
          path="transport/routes"
          element={
            <RequirePermission perm="transport.view">
              <RoutesPage />
            </RequirePermission>
          }
        />
        <Route
          path="transport/routes/:id"
          element={
            <RequirePermission perm="transport.view">
              <RouteDetailPage />
            </RequirePermission>
          }
        />

        <Route
          path="reports"
          element={
            <RequirePermission perm="reports.export">
              <ReportsHubPage />
            </RequirePermission>
          }
        />

        <Route
          path="ai/risk-scores"
          element={
            <RequirePermission perm="reports.export">
              <RiskScoresPage />
            </RequirePermission>
          }
        />
        <Route
          path="ai/document-scanner"
          element={
            <RequirePermission perm="ai.generate_content">
              <DocumentScannerPage />
            </RequirePermission>
          }
        />

        <Route path="403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function ForbiddenPage() {
  return (
    <div className="error-page">
      <h1>403 — Access denied</h1>
      <p>You don't have permission to view this page. Contact your organization administrator if this is unexpected.</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="error-page">
      <h1>404 — Page not found</h1>
    </div>
  );
}
