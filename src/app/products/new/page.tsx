import { ProductForm } from "@/components/ProductForm";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/db";

export default async function NewProductPage() {
  const settings = await (await getRepo()).getSettings();
  return (
    <>
      <PageHeader
        title="商品を登録"
        description="DepopやeBayの商品ページを見ながら入力すると、BUY&SHIP送料・関税・手数料を含めた予想利益が右側（スマホでは下）に表示されます。"
      />
      <ProductForm settings={settings} />
    </>
  );
}
