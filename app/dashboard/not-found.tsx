import ErrorScreen from "@/app/components/ErrorScreen";

export default function DashboardNotFound() {
  return (
    <ErrorScreen
      full={false}
      code="404"
      title="Nothing here"
      message="That page doesn't exist, or you don't have access to it. Use the menu to find what you need."
    />
  );
}
