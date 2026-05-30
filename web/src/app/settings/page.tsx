export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">设置</h2>

      <div className="space-y-6">
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">TTS 默认配置</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">语音</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" defaultValue="zh-CN-YunxiNeural">
                <option value="zh-CN-YunxiNeural">云希 (男声)</option>
                <option value="zh-CN-YunyangNeural">云扬 (男声)</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (女声)</option>
                <option value="zh-CN-XiaoyiNeural">晓伊 (女声)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">语速</label>
              <input type="text" defaultValue="-8%" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">音调</label>
              <input type="text" defaultValue="-3Hz" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">音量</label>
              <input type="text" defaultValue="+0%" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">视频默认配置</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
              <input type="number" defaultValue={1920} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
              <input type="number" defaultValue={1080} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帧率</label>
              <input type="number" defaultValue={30} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">服务配置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Python Worker 地址</label>
              <input type="text" defaultValue="http://localhost:8787" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">项目根目录</label>
              <input type="text" defaultValue="D:/财富密码/视频号/静态图片科普视频" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" readOnly />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
