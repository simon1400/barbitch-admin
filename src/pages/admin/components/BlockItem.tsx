export const BlockItem = ({
  title,
  content,
  addContent,
}: {
  title: string
  content: string
  addContent?: string
}) => {
  return (
    <div className={'rounded-xl shadow-lg bg-white p-5 w-full'}>
      <div>
        <span className={'text-resMd1 md:text-sm text-primary mb-3 md:mb-0 block'}>{title}</span>
      </div>
      <div>
        <span className={'text-h5 md:text-md'}>{content}</span>
      </div>
      {addContent && (
        <div>
          <span className={'text-h5 md:text-sm'}>{addContent}</span>
        </div>
      )}
    </div>
  )
}
