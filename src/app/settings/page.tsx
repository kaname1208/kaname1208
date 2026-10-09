import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/db";

export default async function SettingsPage() {
  const settings = await (await getRepo()).getSettings();
  return (
    <>
      <PageHeader
        title="設定"
        description="利益計算に使う料金・税率・条件を設定します。「確認済み」にしていない項目は推定値として扱われます。"
      />
      <SettingsForm settings={settings} />
    </>
  );
}
